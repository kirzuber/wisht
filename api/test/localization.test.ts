import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isLocale, languageInstruction, normalizeLocale, supportedLocales } from '../src/locale.ts';
import { prepareDeed, reviewGrounding, serveFirstDeed, suggestClarification } from '../src/firstDeed.ts';
import { starterWorksheet } from '../src/starterWorksheet.ts';
import { translate, formatLocalDate, formatLocalDateTime, wishCountNoun } from '../../web/src/i18n.tsx';

describe('JINN localization contract', () => {
  it('supports exactly English, Russian, French and Spanish, with safe browser negotiation',()=>{
    assert.deepEqual(supportedLocales,['en','ru','fr','es']);
    assert.deepEqual(['en-CA','ru-RU','fr-CA','es-ES','uk-UA','zh-CN','bad'].map(normalizeLocale),
      ['en','ru','fr','es','en','en','en']);
    for (const value of supportedLocales) assert.equal(isLocale(value),true);
    assert.equal(isLocale('es-ES'),false);
  });
  it('keeps UI text translated with safe, literal interpolation and localized dates',()=>{
    for(const locale of supportedLocales){
      assert.ok(translate(locale,'My Jinns'));
      assert.ok(translate(locale,'Prepare next Deed'));
      assert.ok(translate(locale,'Your first Deed is ready to inspect and edit.'));
      assert.ok(translate(locale,'Could not complete that action. Please try again.'));
    }
    assert.equal(translate('ru','My Jinns'),'Мои джинны');
    assert.deepEqual([0,1,2,5,11,21,24,31].map(n=>wishCountNoun(n,'ru')),
      ['желаний','желание','желания','желаний','желаний','желание','желания','желание']);
    assert.equal(translate('fr','Continue with {name}',{name:'Maya'}),'Continuer avec Maya');
    assert.equal(translate('es','Continue with {name}',{name:'Maya'}),'Continuar con Maya');
    assert.equal(translate('fr','I want to…'),'Je voudrais…');
    assert.equal(translate('en','Continue with {name}',{name:'Jinn'}),'Continue with Jinn');
    assert.ok(formatLocalDate('2026-11-15','fr').length>0);
    assert.ok(formatLocalDateTime('2026-11-15T12:00:00Z','es'));
  });
  it('instructs every model prompt independently of the text of the Wish',async()=>{
    const calls:string[]=[];
    const requested:'ru'|'fr'|'es'='fr';
    const question=await suggestClarification('I want a book about my family',async messages=>{
      calls.push(messages[0].content);
      return {language:requested,question:'Quel souvenir voulez-vous conserver ?'};
    },requested);
    assert.equal(question,'Quel souvenir voulez-vous conserver ?');
    assert.match(calls[0],/Selected interface locale: fr/);
    assert.match(calls[0],/respectful «vous»/);
    assert.equal(await suggestClarification('I want a garden',async()=>({
      language:'en',question:'Where is it?'
    }),requested),null,'invalid declared response language should not reach user');
  });
  it('uses selected language for draft/review and preserves exact user source note',async()=>{
    const source='Please do not rewrite this English source note';
    const languages= ['ru','fr','es'] as const;
    const names={ru:'План работы',fr:'Plan de départ',es:'Plan inicial'};
    for(const locale of languages){
      let instruction='';
      let reviewer='';
      const out=await prepareDeed('I want a book about my family',source,null,
        async messages=>{
          instruction=messages[0].content;
          return {
            language:locale,title:names[locale],
            sections:[{type:'document',title:names[locale],body:'Un modèle à compléter'}],
            unknowns:['À vérifier'],
            nextDeed:{title:names[locale],why:'Une raison',prompt:'Un pas'},
            boundary:'Document privé. Aucune action effectuée.',
          };
        },
        async (_wish,_source,_artifact,reviewCall,selectedLocale)=>{
          reviewer=languageInstruction(selectedLocale||'en');
          return {safe:true};
        },
        locale);
      assert.equal(out.artifact.sourceNote,source);
      assert.match(instruction,new RegExp('Selected interface locale: '+locale));
      assert.match(reviewer,new RegExp('Selected interface locale: '+locale));
    }
  });
  it('offers a safe worksheet in all four locales when AI responses fail grounding',async()=>{
    for(const locale of supportedLocales){
      const result=await prepareDeed('Write my first story','Keep the real fact verbatim',null,
        async()=>({invalid:'artifact'}),undefined,locale);
      assert.equal(result.receipt.draftSource,'worksheet');
      assert.equal(result.artifact.sourceNote,'Keep the real fact verbatim');
      assert.equal(result.artifact.title,starterWorksheet('',locale).title);
      assert.equal(result.artifact.sections.length,2);
      assert.equal(result.artifact.nextDeed.title.length>0,true);
    }
  });
  it('keeps Ukrainian and Russian Wishes distinct from the chosen output locale',async()=>{
    const ukrainian='Я хочу написати книгу про свою родину';
    const russian='Я хочу написать книгу о своей семье';
    for(const [wish,locale,question] of [
      [ukrainian,'en','Which family memory would you like to record?'],
      [russian,'en','Which family memory would you like to record?'],
      [ukrainian,'ru','Какое семейное воспоминание Вы хотите сохранить?'],
      [russian,'ru','Какое семейное воспоминание Вы хотите сохранить?'],
    ] as const){
      let instruction='';
      const answer=await suggestClarification(wish,async messages=>{
        instruction=messages[0].content;
        return {language:locale,question};
      },locale);
      assert.equal(answer,question);
      assert.match(instruction,new RegExp('Selected interface locale: '+locale));
      assert.ok(!instruction.includes('Infer Russian from Cyrillic'));
    }
    const expectedTitle={en:'Starting a family book',ru:'Начало семейной книги'};
    for(const [wish,locale] of [[ukrainian,'en'],[russian,'en'],[ukrainian,'ru'],[russian,'ru']] as const){
      let modelInstruction='';
      const result=await prepareDeed(wish,wish,null,async messages=>{
        modelInstruction=messages[0].content;
        return {language:locale,title:expectedTitle[locale],
          sections:[{type:'document',title:expectedTitle[locale],body:'Editable draft'}],
          unknowns:['Unknown detail'],nextDeed:{title:expectedTitle[locale],
            why:'One reason',prompt:'Write one detail'},
          boundary:'Private draft, no external action'};
      },async()=>({safe:true} as const),locale);
      assert.equal(result.receipt.draftSource,'model',
        'Input Cyrillic must never force an unrelated output language');
      assert.equal(result.artifact.sourceNote,wish,'Preserve source Wish text verbatim');
      assert.match(modelInstruction,new RegExp('Selected interface locale: '+locale));
    }
  });
  it('rejects a Ukrainian-labelled draft in Russian mode without treating script as proof',async()=>{
    const wish='Я хочу зібрати родинні історії';
    const result=await prepareDeed(wish,wish,null,async()=>({
      language:'uk',title:'Сімейні історії',
      sections:[{type:'document',title:'Питання',body:'Запишіть власні спогади'}],
      unknowns:[],nextDeed:{title:'Перший крок',why:'Важлива причина',prompt:'Напишіть одне речення'},
      boundary:'Особистий чернетковий текст',
    }),undefined,'ru');
    assert.equal(result.receipt.draftSource,'worksheet');
    assert.equal(result.artifact.sourceNote,wish);
    assert.match(result.artifact.title,/Рабочий лист/);
  });
  it('explains Ukrainian/Russian distinction to the grounding reviewer',async()=>{
    let system='';
    const approved=await reviewGrounding('Я хочу зберегти спогади','',
      {title:'План',sourceNote:'',sections:[{type:'document',title:'Крок',body:'Запишіть ідею'}],
        unknowns:[],nextDeed:{title:'Крок',why:'Причина',prompt:'Напишіть'},
        boundary:'Чернетка'},
      async messages=>{system=messages[0].content;return {safe:true}},'ru');
    assert.deepEqual(approved,{safe:true});
    assert.match(system,/Russian and Ukrainian are different languages/);
    assert.match(system,/Selected interface locale: ru/);
  });
  it('rejects unsupported API languages without contacting a model provider',async()=>{
    const response=await serveFirstDeed(new Request('https://example.test/api/first-deed',{
      method:'POST',body:JSON.stringify({mode:'prepare',wish:'Write a book',locale:'de'}),
    }));
    assert.equal(response.status,400);
    assert.deepEqual(await response.json(),{error:'Unsupported language.',code:'invalid_locale'});
  });
});
