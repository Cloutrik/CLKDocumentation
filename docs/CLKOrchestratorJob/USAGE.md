# Usage Guide

This is the reference manual: how to configure tenants and jobs, how to call the HTTP API, and
how to run CLKOrchestratorJob standalone from the published Docker image.

- [Standalone quickstart (published image)](#standalone-quickstart-published-image)
- [tenants.yaml](#tenantsyaml)
- [Job mode: prebuilt](#job-mode-prebuilt)
- [Job mode: pipeline](#job-mode-pipeline)
- [Job mode: existing](#job-mode-existing)
- [HTTP API](#http-api)
- [RabbitMQ ingestion](#rabbitmq-ingestion)
- [Callbacks](#callbacks)
- [Environment variables](#environment-variables)
- [Publishing the image](#publishing-the-image)
- [Current limitations](#current-limitations)

## Standalone quickstart (published image)

You don't need to clone this repository to run CLKOrchestratorJob — only Docker. This sets up a
fresh folder from scratch, using the image published on Docker Hub.

```bash
mkdir clk-orchestrator && cd clk-orchestrator
mkdir -p configs/jobs data
```

Create `configs/tenants.yaml`:

```yaml
tenants:
  - id: cliente_a
    name: "Cliente A Ltda"
    api_key: "sk_live_change_me"
    max_concurrent_jobs: 3
    allowed_jobs:
      - hello_world
```

Create `configs/jobs/hello_world.yaml` (a job that needs no private registry to try):

```yaml
job: hello_world
mode: prebuilt
image: "hello-world"
timeout_seconds: 60
callback:
  type: none
```

Create `docker-compose.yaml`:

```yaml
services:
  orchestrator:
    image: cloutrik/clkorchestratorjob:latest
    ports:
      - "8080:8080"
    environment:
      CLK_CONFIG_DIR: "/app/configs"
      CLK_DATA_DIR: "/app/data"
      CLK_HOST_DATA_DIR: "${CLK_HOST_DATA_DIR:?set this in .env, see below}"
      RABBITMQ_URL: "amqp://guest:guest@rabbitmq:5672/"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./configs:/app/configs:ro
      - ./data:/app/data
    depends_on:
      rabbitmq:
        condition: service_healthy

  rabbitmq:
    image: rabbitmq:3.13-management
    ports:
      - "5672:5672"
      - "15672:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

Create `.env` next to it, pointing at the **absolute host path** of the `data` folder you just
created (this matters for `pipeline`-mode jobs — see the note in
[Environment variables](#environment-variables)):

```bash
# Linux/macOS
echo "CLK_HOST_DATA_DIR=$(pwd)/data" > .env
# Windows (PowerShell), adjust the path to yours
# "CLK_HOST_DATA_DIR=c:/Users/you/clk-orchestrator/data" | Out-File -Encoding utf8 .env
```

Start it and trigger the demo job:

```bash
docker compose up -d
curl -X POST http://localhost:8080/v1/jobs/trigger \
  -H "X-Tenant-Key: sk_live_change_me" \
  -H "Content-Type: application/json" \
  -d '{"job":"hello_world","payload":{}}'
# => {"job_run_id":"..."}

curl http://localhost:8080/v1/jobs/<job_run_id>
curl http://localhost:8080/v1/jobs/<job_run_id>/logs
```

From here, add more entries under `configs/jobs/` and reference them in a tenant's
`allowed_jobs` — no restart needed beyond `docker compose restart orchestrator` (config is
read at startup; hot-reload isn't implemented yet, see [Current limitations](#current-limitations)).

## tenants.yaml

```yaml
tenants:
  - id: cliente_a               # used in labels, storage, and DooD container naming
    name: "Cliente A Ltda"      # display only
    api_key: "sk_live_xxx"      # sent as the X-Tenant-Key HTTP header
    max_concurrent_jobs: 3      # hard cap on simultaneous runs for this tenant
    allowed_jobs:                # job names this tenant is allowed to trigger
      - process_invoice
      - generate_report
```

A job not listed in a tenant's `allowed_jobs` is rejected with `403`, even if it exists in
`configs/jobs/`. `max_concurrent_jobs` is enforced with an in-memory semaphore — a burst of
requests beyond that limit queues in the background rather than failing.

## Job mode: prebuilt

Use this when there's already a built, deployable image — the orchestrator just runs it.

```yaml
job: process_invoice
mode: prebuilt
image: "registry.interna/cliente_a/invoice-worker:1.4.0"
env:
  BATCH_SIZE: "100"
  MODE: "sync"
resources:
  memory: "512m"   # not yet enforced on the container — see Current limitations
  cpus: "0.5"
timeout_seconds: 600
callback:
  type: rabbitmq
  target: "jobs.cliente_a.invoice.done"
```

At run time the orchestrator also injects `CLK_TENANT_ID`, `CLK_JOB_RUN_ID`, and (if the trigger
request included one) `CLK_PAYLOAD_JSON` as environment variables into the container.

## Job mode: pipeline

Use this when the job needs to be assembled at run time: clone a repo, install dependencies,
build an image, then run it. Each run gets its own throwaway workspace directory.

```yaml
job: generate_report
mode: pipeline
workspace:
  strategy: temp_dir
steps:
  - name: clone
    action: git_clone
    repo: "https://github.com/org/report-worker.git"
    ref: "main"

  - name: install
    action: run_in_container      # runs with the workspace bind-mounted at /workspace
    image: "composer:2"
    command: ["composer", "install", "--no-dev"]

  - name: build
    action: docker_build           # builds the workspace (or workspace/<context>) as a Dockerfile
    context: "."
    tag: "cliente_a/report-worker:{{run_id}}"

  - name: run
    action: docker_run             # runs the image just built, no workspace mount
    image: "cliente_a/report-worker:{{run_id}}"
    env:
      REPORT_DATE: "{{payload.date}}"
resources:
  memory: "1g"
  cpus: "1.0"
timeout_seconds: 1800
callback:
  type: webhook
  target: "https://cliente_a.example.com/hooks/report-done"
cleanup:
  remove_workspace_after: true   # rm -rf the workspace once the run finishes, pass or fail
  remove_image_after: false      # keep the built image around (set true to always rebuild fresh)
```

**Step actions:**

| action             | what it does                                                                                   |
|--------------------|--------------------------------------------------------------------------------------------------|
| `git_clone`        | shallow-clones `repo` (optionally at `ref`) into the workspace, via a throwaway `alpine/git` container |
| `run_in_container` | runs `image` with `command`, workspace mounted at `/workspace` (working dir) — mutates the workspace |
| `docker_build`     | builds `context` (relative to the workspace) as a Docker build, tags it `tag`                    |
| `docker_run`       | runs `image` standalone (no workspace mount) — typically the image `docker_build` just produced  |

Steps run in order and stop at the first failure (non-zero exit or infrastructure error, e.g. a
clone that can't reach the repo). Whatever ran is still captured in the job's logs.

**Templating.** Any string field in a step (`repo`, `ref`, `image`, `tag`, `command` entries,
`env` values) may reference:

- `{{run_id}}` — this run's UUID
- `{{payload.<field>}}` — a top-level field from the trigger request's `payload` JSON

**A note on Docker-outside-of-Docker (DooD).** If the orchestrator itself is running inside a
container (as in `docker-compose.yaml`), pipeline steps run as *sibling* containers against the
same Docker daemon — and that daemon resolves volume mounts against its own (the host's)
filesystem, not paths inside the orchestrator's container. `CLK_HOST_DATA_DIR` exists so the
orchestrator can translate its own `/app/data/workspaces/<run_id>` into the real host path the
daemon needs for the bind mount. `docker_build` doesn't have this problem — it streams the
workspace to the daemon as a tar archive over the API instead of mounting it.

## Job mode: existing

Use this when a container's lifecycle is managed by something else entirely — a manual
`docker create`, a separate deploy pipeline, whatever — and triggering the job should only
**start** it, wait for it to exit, and read its logs. Unlike `prebuilt` and `pipeline`, this mode
never creates or removes a container. If it isn't there, the run fails; if it's there but
stopped, it gets started; either way, once it exits it's left alone, stopped, ready to be
started again next time.

This is the shape to use for one job definition covering multiple tenants, each with their own
already-existing, identically-behaving container — e.g. `processoA_clienteA`,
`processoA_clienteB`, ...:

```yaml
job: processoA
mode: existing
container_name: "processoA_{{tenant_id}}"
timeout_seconds: 120
callback:
  type: rabbitmq
  target: "jobs.{{tenant_id}}.processoA.done"
```

`container_name` (and `callback.target`) may reference `{{tenant_id}}`, `{{run_id}}`, and
`{{payload.<field>}}` — the same templating `pipeline` steps use.

Try it:

```bash
docker create --name processoA_cliente_a alpine sh -c "echo run from cliente_a; sleep 1"

curl -X POST http://localhost:8080/v1/jobs/trigger \
  -H "X-Tenant-Key: sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"job":"processoA","payload":{}}'
```

Trigger it again afterward — the same container starts, runs, and stops again; `docker ps -a`
will show it `Exited`, never removed.

**What this mode doesn't do:**

- **`env` isn't supported** — a container's environment is fixed when it's created, and this
  mode never creates one, so `configs/jobs/*.yaml` validation rejects `env` under `mode: existing`
  outright rather than silently ignoring it.
- **`resources` isn't applied** either, for the same reason (limits are set at creation time)
  — same caveat as `prebuilt`/`pipeline` today, see [Current limitations](#current-limitations).
- Logs are scoped to each run (captured only from the moment that run's `docker start` fires),
  so triggering the same container twice doesn't show the first run's output glued onto the
  second's.
- If a run hits `timeout_seconds`, the container is stopped (not removed) so it doesn't keep
  running unbounded — it's still there to start again next time.

## HTTP API

All three ingestion channels described in the original design (HTTP, Kafka, RabbitMQ) share one
payload contract; only HTTP is implemented today.

### `POST /v1/jobs/trigger`

Headers: `X-Tenant-Key: <tenant api_key>`

```json
{
  "job": "process_invoice",
  "payload": { "invoice_id": "12345" }
}
```

| status | meaning                                             |
|--------|------------------------------------------------------|
| 202    | accepted, `{"job_run_id": "..."}`                   |
| 400    | malformed body / missing `job`                      |
| 401    | missing or unknown `X-Tenant-Key`                    |
| 403    | job not in this tenant's `allowed_jobs`              |
| 404    | job not defined in `configs/jobs/`                   |
| 501    | job mode not implemented (currently: none — both `prebuilt` and `pipeline` are live) |

### `GET /v1/jobs/{id}`

```json
{
  "job_run_id": "...",
  "tenant_id": "cliente_a",
  "job": "process_invoice",
  "status": "success",
  "started_at": "2026-07-21T03:09:16Z",
  "finished_at": "2026-07-21T03:09:17Z",
  "exit_code": 0
}
```

`status` is one of `queued`, `running`, `success`, `failed`, `timeout`.

### `GET /v1/jobs/{id}/logs`

Plain-text combined stdout/stderr. For `pipeline` jobs, logs are sectioned per step. Returns
`202` with a short message if the run hasn't produced logs yet (still `queued`/`running`).

## RabbitMQ ingestion

Jobs can also be triggered by publishing a message instead of calling the HTTP endpoint — same
validation, same `Orchestrator.Trigger` path, same job run underneath. On startup the
orchestrator declares a durable queue (`clk.jobs.trigger` by default) and consumes from it
alongside serving HTTP.

Since AMQP messages have no per-channel header convention like HTTP's `X-Tenant-Key`, the tenant
key travels in the message body instead:

```json
{
  "tenant_key": "sk_live_xxx",
  "job": "process_invoice",
  "payload": { "invoice_id": "12345" }
}
```

```bash
docker exec <rabbitmq-container> rabbitmqadmin publish \
  routing_key=clk.jobs.trigger \
  payload='{"tenant_key":"sk_live_xxx","job":"hello_world","payload":{}}'
```

The result is queryable the same way as an HTTP-triggered run, via `GET /v1/jobs/{id}`.

**Delivery semantics:** each message is acknowledged after exactly one `Trigger` attempt.
Malformed JSON, missing `tenant_key`/`job`, an unknown tenant, or a job outside the tenant's
`allowed_jobs` are logged and the message is discarded (not requeued) — redelivery wouldn't
change the outcome. There's no dead-letter queue yet, so discarded messages are simply gone;
check the orchestrator's logs if a trigger you published doesn't seem to have run.

The queue name is configurable via `CLK_TRIGGER_QUEUE` (see
[Environment variables](#environment-variables)). If RabbitMQ isn't reachable at startup, this
is logged and the orchestrator continues serving HTTP without it — it isn't fatal.

Kafka ingestion (the other channel described in the original design) isn't implemented yet.

## Callbacks

Set per job in `callback.type`:

- `rabbitmq` — declares `callback.target` as a durable queue and publishes the completion
  message to it via the default exchange
- `webhook` — `POST`s the completion message as JSON to `callback.target`
- `none` (or omitted) — no notification
- `kafka` — accepted by config validation but not implemented yet (returns an error at dispatch
  time, logged, non-fatal to the job run)

Completion message shape (identical for both transports):

```json
{
  "job_run_id": "...",
  "tenant_id": "cliente_a",
  "job": "process_invoice",
  "status": "success",
  "exit_code": 0,
  "finished_at": "2026-07-21T03:09:17Z"
}
```

## Environment variables

| variable             | default                                   | meaning                                                        |
|----------------------|--------------------------------------------|-----------------------------------------------------------------|
| `CLK_CONFIG_DIR`     | `configs`                                  | directory containing `tenants.yaml` and `jobs/`                 |
| `CLK_DATA_DIR`       | `data`                                     | directory for the SQLite DB, run logs, and pipeline workspaces   |
| `CLK_HOST_DATA_DIR`  | absolute path of `CLK_DATA_DIR`             | `CLK_DATA_DIR` as seen by the Docker daemon — only matters when the orchestrator itself runs in a container; see the DooD note above |
| `CLK_HTTP_ADDR`      | `:8080`                                    | HTTP listen address                                              |
| `RABBITMQ_URL`       | `amqp://guest:guest@localhost:5672/`        | used for both `rabbitmq`-type callbacks and job-trigger ingestion; unreachable at startup just disables the affected feature (logged, non-fatal) |
| `CLK_TRIGGER_QUEUE`  | `clk.jobs.trigger`                          | queue consumed for [RabbitMQ ingestion](#rabbitmq-ingestion)     |

## Publishing the image

```bash
docker build -t cloutrik/clkorchestratorjob:latest .
docker login
docker push cloutrik/clkorchestratorjob:latest
```

The repo's `.github/workflows/docker-publish.yml` does this automatically on every push to
`main` (and on version tags) once `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are set as secrets
in the GitHub repository's settings.

## Current limitations

- `resources.memory` / `resources.cpus` are parsed and validated but not yet applied as container
  limits (planned for Fase 4).
- No per-tenant Docker network isolation yet (Fase 4).
- Kafka ingestion isn't implemented (Fase 2 is done for RabbitMQ, not Kafka). There's also no
  dead-letter queue for RabbitMQ-ingested messages that fail validation — see
  [RabbitMQ ingestion](#rabbitmq-ingestion).
- Config is loaded once at startup; changing `configs/` requires restarting the orchestrator.
- Mounting `/var/run/docker.sock` (DooD) gives the orchestrator full control of the host's Docker
  daemon. Fine for a single trusted operator; if you're running workloads for tenants you don't
  fully trust, treat this as a known gap, not a solved problem — see the README's Contributing
  section.
