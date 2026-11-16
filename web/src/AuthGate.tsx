import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { browserDiagnostic, diagnosticCode } from './browserDiagnostics';
import JinnAvatar from './JinnAvatar';
import { localizeError, useLocale } from './i18n';

type Props = { purpose: string; onAuthenticated: () => void; onCancel: () => void; showCompanion?: boolean };
const localMail = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(import.meta.env.VITE_SUPABASE_URL ?? '');
const mailpit = 'http://127.0.0.1:54324/';

function logAuthFailure(step: 'request' | 'verify', error: unknown) {
  const failure = error as { code?: unknown; status?: unknown } | null;
  browserDiagnostic('error', `auth.otp.${step}.failed`, {
    code: diagnosticCode(failure?.code) ?? 'auth_request_failed',
    status: typeof failure?.status === 'number' ? failure.status : undefined,
  });
}

export default function AuthGate({ purpose, onAuthenticated, onCancel, showCompanion = false }: Props) {
  const {locale,t}=useLocale();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState<'send'|'verify'|null>(null);
  const busy = pending !== null;
  const [error, setError] = useState('');
  // A returning verified user should pass the gate without being asked for email again.
  useEffect(() => {
    void getAuthenticatedUser().then(() => onAuthenticated()).catch(() => {});
    // This check is only needed on initial mount; the caller handles the authenticated transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const sendCode = async () => {
    if (!email.trim() || busy) return;
    setPending('send'); setError('');
    browserDiagnostic('info', 'auth.otp.request.started');
    try {
      const { error: sendError } = await getSupabase().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true }
      });
      if (sendError) throw sendError;
      setCode('');
      setSent(true);
      browserDiagnostic('info', localMail ? 'auth.otp.request.accepted_local' : 'auth.otp.request.accepted');
    } catch (cause) {
      logAuthFailure('request', cause);
      setError(localizeError(cause,locale,'Could not send verification email.'));
    }
    finally { setPending(null); }
  };

  const verifyCode = async () => {
    if (!/^\d{6,10}$/.test(code) || busy) return;
    setPending('verify'); setError('');
    browserDiagnostic('info', 'auth.otp.verify.started');
    try {
      const { error: verifyError } = await getSupabase().auth.verifyOtp({
        email: email.trim().toLowerCase(), token: code, type: 'email'
      });
      if (verifyError) throw verifyError;
      await getAuthenticatedUser();
      browserDiagnostic('info', 'auth.otp.verify.succeeded');
      onAuthenticated();
    } catch (cause) {
      logAuthFailure('verify', cause);
      setError(localizeError(cause,locale,'Could not verify your code.'));
    }
    finally { setPending(null); }
  };

  return <section className="content entrance">
    {showCompanion&&<JinnAvatar size="medium"/>}
    <p className="eyebrow">{t('ONE QUICK THING')}</p>
    <h2>{t("Let's make this")} <em>{t('yours.')}</em></h2>
    <p className="lead narrower">{purpose} {t('Verify your email so you can return to the work later.')}</p>
    <div className="result-card">
      {!sent ? <form onSubmit={e => { e.preventDefault(); void sendCode(); }}>
        <label className="field-label" htmlFor="auth-email">{t('YOUR EMAIL')}</label>
        <input id="auth-email" type="email" autoComplete="email" required value={email}
          onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
          style={{ width:'100%', padding:13, border:'1px solid #ddd9cc', borderRadius:9, marginBottom:16 }}/>
        <button type="submit" className="primary" disabled={busy || !email.trim()}>
          <Mail size={18}/> {t(busy ? 'Sending…' : 'Send a sign-in code')} <ArrowRight size={16}/>
        </button>
      </form> : <form onSubmit={e => { e.preventDefault(); void verifyCode(); }}>
        <p className="detail" style={{marginBottom:14}}>{localMail
          ? <>{t('Open the')} <a href={mailpit} target="_blank" rel="noreferrer">{t('local inbox (Mailpit)')}</a> {t('for the code addressed to {email}.',{email})}</>
          : <>{t('Check {email} for your sign-in code.',{email})}</>}</p>
        <label className="field-label" htmlFor="auth-code">{t('VERIFICATION CODE')}</label>
        <input id="auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={10}
          required pattern="[0-9]{6,10}" value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0, 10))}
          placeholder={t(localMail ? 'Enter the code from Mailpit' : 'Enter the code from your email')}
          style={{ width:'100%', padding:13, border:'1px solid #ddd9cc', borderRadius:9, marginBottom:16, letterSpacing:3 }}/>
        <button type="submit" className="primary" disabled={busy || !/^\d{6,10}$/.test(code)}>
          <KeyRound size={18}/> {t(pending === 'verify' ? 'Verifying…' : 'Verify and continue')} <ArrowRight size={16}/>
        </button>
        <button className="back" type="button" disabled={busy} onClick={()=>void sendCode()}>{t(pending === 'send' ? 'Requesting…' : 'Request a new code')}</button>
        <button className="back" type="button" disabled={busy} onClick={()=>{setSent(false);setCode('');setError('');}}>{t('Use another email')}</button>
      </form>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <p className="mini-note"><ShieldCheck size={15}/> {t('No password needed. Your work is saved only after verification.')}</p>
    <button type="button" className="back" onClick={onCancel}><ArrowLeft size={16}/> {t('Not now — keep exploring')}</button>
  </section>;
}
