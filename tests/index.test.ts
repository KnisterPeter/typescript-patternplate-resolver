// xxx: workaround https://github.com/avajs/ava/issues/2151
declare global { interface SymbolConstructor { readonly observable: symbol; } }

// tslint:disable-next-line:no-implicit-dependencies
import test from 'ava';

test('ok', t => {
  t.pass();
});
