import {registerHooks} from 'node:module';
const playwrightURL=import.meta.resolve('playwright');
registerHooks({resolve(specifier,context,nextResolve){return specifier==='playwright'?{url:playwrightURL,shortCircuit:true}:nextResolve(specifier,context);}});
import {chromium} from 'playwright';
const launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({...options,channel:'chromium'});
await import('/home/hatch/.hermes/skills/game-development/develop-web-game/scripts/web_game_playwright_client.js');
