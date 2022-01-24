declare const Zotero: any
// declare const Components: any

import { debug } from './debug'
import { EventEmitter2 as EventEmitter } from 'eventemitter2'
import { DiGraph, Dijkstra } from './dijkstra'

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
  private query: { graph: string, items: string, creators: string }
  // private start: string

  private graph: DiGraph

  public creators: {
    byName: Record<string, string>
    byId: Record<string, string>
  }
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
          creators: Zotero.File.getContentsFromURL('resource://zotero-erdos/creators.sql').replace(/[\r\n]/g, ' '),
        }
        debug('queries loaded')
        Zotero.Notifier.registerObserver(this, ['item'], 'Erdos', 1)
        this.started = true
        await this.refresh()
      }
      catch (err) {
        debug('Error:', err.message)
      }
    })
  }

  private async refresh() {
    debug('start refresh')
    this.graph = {}
    for (const {v, w} of (await Zotero.DB.queryAsync(this.query.graph))) {
      this.graph[v] = this.graph[v] || {}
      this.graph[v][w] = 1

      this.graph[w] = this.graph[w] || {}
      this.graph[w][v] = 1
    }
    this.creators = { byName: {}, byId: {} }
    for (const {creatorID, creatorName} of (await Zotero.DB.queryAsync(this.query.creators))) {
      this.creators.byName[creatorName] = creatorID
      this.creators.byId[creatorID] = creatorName
    }
    debug('graph refreshed')
    this.event.emit('graph.refresh')
  }

  private async notify(_action: any, _type: any, _ids: any[], _extraData: any) {
    await this.refresh()
  }

  public async search(creator: string, cocreator: string): Promise<ReportStep[][]> {
    try {
      const creator_id = this.creators.byName[creator]
      const cocreator_id = this.creators.byName[cocreator]
      const pathfinder = new Dijkstra(this.graph, creator_id)

      if (!pathfinder.reachable(cocreator_id)) return null

      // path = (src) - I - C - I - C ....
      const paths = pathfinder.paths(cocreator_id)
      debug('paths:', paths)
      const vertices: string[] = [].concat(...paths)

      const itemIDs = vertices.filter(v => v[0] === 'I').map(i => i.substr(1)).join(',')
      const items: Record<string, { title: string, itemID: number, libraryID: number, select?: string  }> = {}
      for (const { itemID, title, libraryID } of (await Zotero.DB.queryAsync(`${this.query.items} WHERE i.itemID IN (${itemIDs})`))) {
        items[`I${itemID}`] = {
          title,
          itemID,
          libraryID,
        }
      }
      debug('items:', items)

      return paths.map(path => path
        // get C-I-C
        .map((_, i) => i % 2 === 0 ? path.slice(i, i+3) : undefined) // eslint-disable-line @typescript-eslint/no-magic-numbers
        // remove I-C-I and tail
        .filter(step => step && step.length === 3) // eslint-disable-line @typescript-eslint/no-magic-numbers
        .map(([cr, item, co]) => ({ creator: this.creators.byId[cr], ...items[item], cocreator: this.creators.byId[co] }))
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
