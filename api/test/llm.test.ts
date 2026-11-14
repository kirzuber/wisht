import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { interpretWishSmart } from '../src/llm.ts';

describe('Selective LLM routing', () => {
  it('does not call an LLM for a known wish, even with a configured key', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('Should not call an LLM'); };
    try {
      const result = await interpretWishSmart('I want to be a photographer', { DEEPSEEK_API_KEY: 'test-key' });
      assert.equal(result.route, 'catalog');
      assert.equal(result.interpretation.kind, 'photography');
    } finally { globalThis.fetch = original; }
  });

  it('falls back when no provider key is configured', async () => {
    const result = await interpretWishSmart('I want to be a wizard on Neptune', {});
    assert.equal(result.route, 'fallback');
    assert.equal(result.interpretation.supported, false);
  });

  it('uses DeepSeek Flash in non-thinking JSON mode when a DeepSeek key exists', async () => {
    const original = globalThis.fetch;
    let endpoint = '';
    let request: Record<string, unknown> = {};
    globalThis.fetch = async (input, init) => {
      endpoint = String(input);
      request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({choices:[{message:{content:JSON.stringify({kind:'photography'})}}]});
    };
    try {
      const result = await interpretWishSmart('I want to become a shutterbug', {DEEPSEEK_API_KEY:'test-key'});
      assert.equal(result.route, 'llm');
      assert.equal(result.interpretation.kind, 'photography');
      assert.equal(endpoint, 'https://api.deepseek.com/chat/completions');
      assert.equal(request.model, 'deepseek-flash');
      assert.equal(request.reasoning_effort, 'none');
      assert.deepEqual(request.response_format, {type:'json_object'});
    } finally { globalThis.fetch = original; }
  });

  it('supports explicit OpenAI selection without leaking a DeepSeek key', async () => {
    const original = globalThis.fetch;
    let endpoint = '';
    let authorization = '';
    globalThis.fetch = async (input, init) => {
      endpoint = String(input);
      authorization = new Headers(init?.headers).get('Authorization') || '';
      return Response.json({choices:[{message:{content:'{"kind":"career"}'}}]});
    };
    try {
      const result = await interpretWishSmart('I want to be a recruiter', {LLM_PROVIDER:'openai',OPENAI_API_KEY:'openai-test',DEEPSEEK_API_KEY:'deepseek-test'});
      assert.equal(result.route, 'llm');
      assert.equal(endpoint, 'https://api.openai.com/v1/chat/completions');
      assert.equal(authorization, 'Bearer openai-test');
    } finally { globalThis.fetch = original; }
  });

  it('does not trust an unknown model-suggested skill', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => Response.json({choices:[{message:{content:'{"kind":"execute-payments"}'}}]});
    try {
      const result = await interpretWishSmart('I want something unusual', {DEEPSEEK_API_KEY:'test-key'});
      assert.equal(result.route, 'fallback');
      assert.equal(result.interpretation.missions.length, 0);
    } finally { globalThis.fetch = original; }
  });

  it('returns fallback if the provider fails', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response('unavailable', {status:503});
    try {
      const result = await interpretWishSmart('I want something unusual', {DEEPSEEK_API_KEY:'test-key'});
      assert.equal(result.route,'fallback');
    } finally {globalThis.fetch=original;}
  });
});
