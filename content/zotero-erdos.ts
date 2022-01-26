declare const Zotero: any
// declare const Components: any

import { debug } from './debug'
import { EventEmitter2 as EventEmitter } from 'eventemitter2'
import { Dijkstra } from './dijkstra'
import UndirectedGraph from 'graphology'

/*
const monkey_patch_marker = 'ErdosMonkeyPatched'
function patch(object, method, patcher) {
  if (object[method][monkey_patch_marker]) return
  object[method] = patcher(object[method])
  object[method][monkey_patch_marker] = true
}
*/

export type ReportStep = {
  creator: string
  cocreator: string
  title: string
  itemID: number
  libraryID: number
}

export class Erdos { // tslint:disable-line:variable-name
  private initialized = false
  private globals: Record<string, any>
  private strings: any
  private query: { graph: string, items: string }
  // private start: string

  public graph: UndirectedGraph
  public event = new EventEmitter({ wildcard: true, delimiter: '.', ignoreErrors: false })
  public started = false

  constructor() {
    this.event.on('start', async ({ document: doc }: { document: Document }) => { // eslint-disable-line @typescript-eslint/no-misused-promises
      try {
        debug('started')
        await Zotero.Schema.schemaUpdatePromise
        debug('ready')

        this.strings = doc.getElementById('zotero-erdos-strings')
        debug('strings loaded')
        this.query = {
          graph: Zotero.File.getContentsFromURL('resource://zotero-erdos/graph.sql').replace(/[\r\n]/g, ' '),
          items: Zotero.File.getContentsFromURL('resource://zotero-erdos/items.sql').replace(/[\r\n]/g, ' '),
        }
        debug('queries loaded')
        Zotero.Notifier.registerObserver(this, ['item'], 'Erdos', 1)
        this.started = true
        await this.refresh()

        Zotero.Prefs.registerObserver('erdos.lastname-search', this.refresh.bind(this))
      }
      catch (err) {
        debug('Error:', err.message)
      }
    })
  }

  public gml(): string {
    let gml = 'graph [\n'

    this.graph.forEachNode((node, attr) => {
      gml += `  node [\n    id ${attr.id}\n    label ${JSON.stringify(attr.name || attr.title || node)}\n  ]\n`
    })

    this.graph.forEachEdge((edge, attributes, source, target, sourceAttributes, targetAttributes) => {
      gml += `  edge [\n    source ${sourceAttributes.id}\n    target ${targetAttributes.id}\n  ]\n`
    })

    gml += ']'

    return gml
  }

  private edgeKey(src: string, tgt: string): string {
    return [src, tgt].sort().join('<>')
  }

  private async refresh() {
    const lastnameSearch: boolean = Zotero.Prefs.get('erdos.lastname-search')
    debug('start refresh', lastnameSearch)

    let nodeID = 0
    this.graph = new UndirectedGraph
    for (const {itemID, creatorID, creatorName, lastNameID, lastName} of (await Zotero.DB.queryAsync(this.query.graph) as Record<string, string>[])) {
      this.graph.mergeNode(`I${itemID}`, { type: 'item', itemID, id: nodeID += 1 })
      this.graph.mergeNode(`C${creatorID}`, { type: 'creator', name: creatorName, creatorID, id: nodeID += 1, lastname: lastName && lastnameSearch ? `L${lastNameID}` : '' })
      this.graph.addUndirectedEdgeWithKey(this.edgeKey(`I${itemID}`, `C${creatorID}`), `I${itemID}`, `C${creatorID}`)

      if (lastnameSearch) {
        this.graph.mergeNode(`L${lastNameID}`, { type: 'lastname', name: lastName, lastNameID, id: nodeID += 1 })
        this.graph.mergeUndirectedEdgeWithKey(this.edgeKey(`I${itemID}`, `L${lastNameID}`), `I${itemID}`, `L${lastNameID}`, { name: creatorName })
      }
    }

    for (const { itemID, title, libraryID } of (await Zotero.DB.queryAsync(this.query.items) as Record<string, string>[])) {
      this.graph.mergeNode(`I${itemID}`, { title, itemID, libraryID })
    }

    debug('graph refreshed', lastnameSearch)
    debug(this.gml())
    // debug(JSON.stringify(this.graph.export()))
    this.event.emit('graph.refresh')
  }

  private async notify(_action: any, _type: any, _ids: any[], _extraData: any) {
    await this.refresh()
  }

  creatorName(creator: string, item: string): string {
    switch (creator[0]) {
      case 'C': return this.graph.getNodeAttribute(creator, 'name') as string
      case 'L': return this.graph.getUndirectedEdgeAttribute(this.edgeKey(creator, item), 'name') as string
      default: throw new Error(`Unexpected creator node ${JSON.stringify(creator)}`)
    }
  }

  public search(creator: string, cocreator: string): ReportStep[][] {
    try {
      let creator_id: string = this.graph.findNode((id, attr) => id[0] === 'C' && attr.name === creator)
      let cocreator_id: string = this.graph.findNode((id, attr) => id[0] === 'C' && attr.name === cocreator)
      if (Zotero.Prefs.get('erdos.lastname-search')) {
        creator_id = this.graph.getNodeAttribute(creator_id, 'lastname') || creator_id
        cocreator_id = this.graph.getNodeAttribute(cocreator_id, 'lastname') || cocreator_id
      }

      const pathfinder = new Dijkstra(this.graph, creator_id)
      if (!pathfinder.reachable(cocreator_id)) return null

      const paths: string[][] = pathfinder.paths(cocreator_id)
      debug('paths:', paths)
      if (!paths.length) return null

      return paths.map(path => path
        // get C/L-I-C/L
        .map((v, i) => (v[0] === 'C' || v[0] === 'L') ? path.slice(i, i+3) : undefined) // eslint-disable-line @typescript-eslint/no-magic-numbers
        // remove I-C-I and tail
        .filter(step => step && step.length === 3) // eslint-disable-line @typescript-eslint/no-magic-numbers
        .map(([cr, item, co]) => ({ creator: this.creatorName(cr, item), ...(this.graph.getNodeAttributes(item) as { title: string, itemID: number, libraryID: number }), cocreator: this.creatorName(co, item) }))
      )
    }
    catch (err) {
      debug('error: search', err.message, '\n', err.stack)
      return null
    }
  }
}

if (!Zotero.Erdos) {
  Zotero.Erdos = new Erdos
}
