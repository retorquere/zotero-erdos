const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')
const pug = require('pug')

require('zotero-plugin/copy-assets')
require('zotero-plugin/rdf')
require('zotero-plugin/version')

const pugloader = {
  name: 'pugjs',
  setup(build) {
    build.onLoad({ filter: /\.pug$/ }, args => {
      // await fs.promises.writeFile(args.path.replace(/\.pug$/, '.js'), pug.compileClient(await fs.promises.readFile(args.path, 'utf-8')) + '\nmodule.exports = template\n')
      return {
        contents: pug.compileFileClient(args.path) + '\nmodule.exports = template\n',
        loader: 'js'
      }
    })
  }
}

async function build() {
  await esbuild.build({
    plugins: [ pugloader ],
    bundle: true,
    format: 'iife',
    target: ['firefox60'],
    entryPoints: [ 'content/zotero-erdos.ts' ],
    outdir: 'build/content',
  })
  await esbuild.build({
    target: ['firefox60'],
    entryPoints: [ 'content/dijkstra/index.ts' ],
    outdir: 'build/content/dijkstra',
  })
}

build().catch(err => {
  console.log(err)
  process.exit(1)
})
