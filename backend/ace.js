/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
| Em dev / build (sem JS compilado): registra ts-node-maintained pra
| resolver .ts dinamicamente.
| Em prod (depois do build, dentro do build/): bin/console.js já existe,
| importa direto sem loader nenhum.
|--------------------------------------------------------------------------
*/

import { register } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const compiledConsoleExists = existsSync(
  fileURLToPath(new URL('./bin/console.js', import.meta.url))
)

if (!compiledConsoleExists) {
  register('ts-node-maintained/esm', import.meta.url)
}

await import('./bin/console.js')