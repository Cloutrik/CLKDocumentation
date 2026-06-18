import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

export default function Home() {
  return (
    <Layout
      title="CLOUTRIK Docs"
      description="Documentacao da CLOUTRIK para cloud tricks, qualidade e engenharia real"
    >
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.gridLayer} />
          <div className={styles.signalOne} />
          <div className={styles.signalTwo} />
          <div className={styles.heroInner}>
            <div className={styles.copy}>
              <span className={styles.kicker}>docs.cloutrik.com</span>
              <h1>CLOUTRIK Docs</h1>
              <p>
                Documentacao para aprender cloud tricks com criterios claros:
                qualidade, Git, CI/CD, observabilidade, mensageria,
                microservicos e ranking por evidencia.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryButton} to="/docs/intro/">
                  Documentação
                </Link>
                <Link className={styles.secondaryButton} to="https://cloutrik.com">
                  Homepage
                </Link>
              </div>
            </div>

            <div className={styles.visualPanel}>
              <div className={styles.markdownWindow}>
                <div className={styles.windowHeader}>
                  <span />
                  <span />
                  <span />
                  <strong>cloud-tricks.md</strong>
                </div>
                <div className={styles.markdownBody}>
                  <p className={styles.mdTitle}># Qualidade por evidencia</p>
                  <p><span>##</span> Trilha inicial</p>
                  <ul>
                    <li>[x] PR revisado</li>
                    <li>[x] Pipeline aprovado</li>
                    <li>[x] Logs e metricas</li>
                    <li>[ ] Ranking atualizado</li>
                  </ul>
                  <div className={styles.mdCode}>
                    <code>score: 94/100</code>
                    <code>badge: cloud-starter</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
