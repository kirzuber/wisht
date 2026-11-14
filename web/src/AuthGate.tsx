import { useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { getAuthenticatedUser, getSupabase } from './supabaseClient';

type Props = { purpose: string; onAuthenticated: () => void; onCancel: () => void };
export default function AuthGate({ purpose, onAuthenticated, onCancel }: Props) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async () => {
    if (!email.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const { error: sendError } = await getSupabase().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + window.location.pathname }
      });
      if (sendError) throw sendError;
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send verification email.'); }
    finally { setBusy(false); }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code) || busy) return;
    setBusy(true); setError('');
    try {
      const { error: verifyError } = await getSupabase().auth.verifyOtp({
        email: email.trim().toLowerCase(), token: code, type: 'email'
      });
      if (verifyError) throw verifyError;
      await getAuthenticatedUser();
      onAuthenticated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not verify your code.'); }
    finally { setBusy(false); }
  };

  return <section className="content entrance">
    <p className="eyebrow">ONE QUICK THING</p>
    <h2>Let's make this <em>yours.</em></h2>
    <p className="lead narrower">{purpose} Verify your email so you can return to the work later.</p>
    <div className="result-card">
      {!sent ? <form onSubmit={e => { e.preventDefault(); void sendCode(); }}>
        <label className="field-label" htmlFor="auth-email">YOUR EMAIL</label>
        <input id="auth-email" type="email" autoComplete="email" required value={email}
          onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
          style={{ width:'100%', padding:13, border:'1px solid #ddd9cc', borderRadius:9, marginBottom:16 }}/>
        <button type="submit" className="primary" disabled={busy || !email.trim()}>
          <Mail size={18}/> {busy ? 'Sending…' : 'Send a sign-in code'} <ArrowRight size={16}/>
        </button>
      </form> : <form onSubmit={e => { e.preventDefault(); void verifyCode(); }}>
        <p className="detail" style={{marginBottom:14}}>Check <strong>{email}</strong> for a six-digit code.</p>
        <label className="field-label" htmlFor="auth-code">VERIFICATION CODE</label>
        <input id="auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          required pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value.replace(/\D/g,''))}
          placeholder="000000"
          style={{ width:'100%', padding:13, border:'1px solid #ddd9cc', borderRadius:9, marginBottom:16, letterSpacing:3 }}/>
        <button type="submit" className="primary" disabled={busy || code.length !== 6}>
          <KeyRound size={18}/> {busy ? 'Verifying…' : 'Verify and continue'} <ArrowRight size={16}/>
        </button>
        <button className="back" type="button" onClick={()=>{setSent(false);setCode('');setError('');}}>Use another email</button>
      </form>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <p className="mini-note"><ShieldCheck size={15}/> No password needed. Nothing is uploaded before verification.</p>
    <button type="button" className="back" onClick={onCancel}><ArrowLeft size={16}/> Not now — keep exploring</button>
    <p className="subtle"><LockKeyhole size={13}/> During development, Supabase must be configured to send a six-digit OTP.</p>
  </section>;
}
