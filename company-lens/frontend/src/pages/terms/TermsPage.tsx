import { useTranslation } from 'react-i18next';

import { AppShell } from '../../widgets/app-shell';
import styles from './TermsPage.module.css';

/**
 * 用户协议静态页。注册表单的「同意用户协议」勾选指向这里（新开标签，不打断填写）。
 *
 * ⚠️ 当前条款为按产品形态起草的通用文本（AI 研究工具、仅供研究参考、不构成投资建议），
 * 发布前应由项目负责人/法务审定；修订后同步更新「最后更新」日期。
 * 中英文随站点语言切换，两份文本需保持同义。
 */
export function TermsPage() {
  const { i18n } = useTranslation();
  const isZh = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('zh');

  return (
    <AppShell>
      <main className={styles.main}>
        <article className={styles.card}>
          {isZh ? (
            <>
              <h1 className={styles.title}>用户协议</h1>
              <p className={styles.updated}>最后更新：2026-08-05</p>

              <h2>1. 服务性质</h2>
              <p>
                AI Berkshire（下称「本服务」）是一款 AI
                驱动的公司研究工具，围绕你输入的研究对象自动生成研究报告。所有输出仅供研究参考，
                不构成任何投资建议、要约或承诺；据此作出的任何决策与后果由你自行承担。
              </p>

              <h2>2. 账户</h2>
              <p>
                你可以通过邮箱（验证码或密码）或 Google
                授权创建账户。你有责任妥善保管登录凭据，账户下发生的操作视为你本人所为；发现异常请及时重置密码。
              </p>

              <h2>3. 数据与隐私</h2>
              <p>
                为提供服务，我们会存储你的邮箱、账户资料与研究记录。这些数据用于登录、跨设备同步与产品改进，
                不会出售给第三方。你删除历史记录后，对应内容不再向你展示。
              </p>

              <h2>4. 使用规范</h2>
              <p>
                你承诺不利用本服务从事违法活动，不进行恶意爬取、攻击、逆向或干扰服务运行的行为，
                不批量注册账户或转售服务能力。
              </p>

              <h2>5. 知识产权</h2>
              <p>
                本服务的界面、代码与模型编排归运营方所有。你对自己发起研究所产出的报告享有个人使用权，
                可用于自身研究与分享，但不得声称其为专业投资建议。
              </p>

              <h2>6. AI 局限与免责</h2>
              <p>
                报告由 AI 自动生成，可能存在错误、遗漏或过时信息。我们不对报告的准确性、完整性或适用性作任何保证。
                在法律允许的范围内，运营方不对因使用本服务造成的任何直接或间接损失承担责任。
              </p>

              <h2>7. 服务变更与终止</h2>
              <p>
                我们可能随时调整、暂停或终止部分或全部功能。对于免费能力的变更，恕不单独通知。
              </p>

              <h2>8. 协议修订</h2>
              <p>
                我们可能不时修订本协议并更新本页。修订后你继续使用本服务，即视为接受修订后的条款。
              </p>
            </>
          ) : (
            <>
              <h1 className={styles.title}>Terms of Service</h1>
              <p className={styles.updated}>Last updated: 2026-08-05</p>

              <h2>1. Nature of the service</h2>
              <p>
                AI Berkshire (the “Service”) is an AI-powered company research tool that generates
                research reports for the subjects you enter. All output is for research reference
                only and does not constitute investment advice, an offer, or a commitment of any
                kind. Any decision made based on it is your own responsibility.
              </p>

              <h2>2. Accounts</h2>
              <p>
                You can create an account with your email (verification code or password) or via
                Google. You are responsible for safeguarding your credentials; activity under your
                account is deemed yours. Reset your password promptly if you suspect abuse.
              </p>

              <h2>3. Data &amp; privacy</h2>
              <p>
                To provide the Service we store your email, account profile, and research history.
                This data is used for sign-in, cross-device sync, and product improvement, and is
                not sold to third parties. Deleted history is no longer shown to you.
              </p>

              <h2>4. Acceptable use</h2>
              <p>
                You agree not to use the Service for unlawful purposes, nor to scrape, attack,
                reverse engineer, or disrupt it, nor to mass-register accounts or resell its
                capabilities.
              </p>

              <h2>5. Intellectual property</h2>
              <p>
                The Service’s interface, code, and model orchestration belong to the operator. You
                may use and share reports generated from your own research for personal purposes,
                but may not present them as professional investment advice.
              </p>

              <h2>6. AI limitations &amp; disclaimer</h2>
              <p>
                Reports are generated automatically and may contain errors, omissions, or outdated
                information. We make no warranty as to accuracy, completeness, or fitness for
                purpose. To the extent permitted by law, the operator is not liable for any direct
                or indirect loss arising from use of the Service.
              </p>

              <h2>7. Changes &amp; termination</h2>
              <p>
                We may adjust, suspend, or terminate any part of the Service at any time. Changes
                to free capabilities may happen without individual notice.
              </p>

              <h2>8. Amendments</h2>
              <p>
                We may revise these terms from time to time and update this page. Continued use of
                the Service after a revision constitutes acceptance of the revised terms.
              </p>
            </>
          )}
        </article>
      </main>
    </AppShell>
  );
}
