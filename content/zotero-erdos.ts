declare const Zotero: any
// declare const Components: any

import { debug } from './debug'
import { EventEmitter2 as EventEmitter } from 'eventemitter2'
import { DiGraph, Dijkstra } from './dijkstra'


type Creator = { fieldMode: number, firstName: string, lastName: string }

if (!Zotero.Erdos) {
  const monkey_patch_marker = 'ErdosMonkeyPatched'

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-inner-declarations, prefer-arrow/prefer-arrow-functions
  function patch(object, method, patcher) {
    if (object[method][monkey_patch_marker]) return
    object[method] = patcher(object[method])
    object[method][monkey_patch_marker] = true
  }

  class Erdos { // tslint:disable-line:variable-name
    private graph: DiGraph
    private pathfinder: Dijkstra
    private initialized = false
    private globals: Record<string, any>
    private strings: any
    private query: string
    private start: string

    public event = new EventEmitter({ wildcard: true, delimiter: '.', ignoreErrors: false })

    private observer: MutationObserver

    constructor() {
      this.event.on('start', async ({ document: doc }) => { // eslint-disable-line @typescript-eslint/no-misused-promises
        try {
          debug('started')
          await Zotero.Schema.schemaUpdatePromise
          debug('ready')

          this.strings = doc.getElementById('zotero-erdos-strings')
          debug('strings loaded')
          this.query = Zotero.File.getContentsFromURL('resource://zotero-erdos/graph.sql').replace(/[\r\n]/g, ' ')
          debug('query loaded')
          Zotero.Notifier.registerObserver(this, ['item'], 'Erdos', 1)
          debug('start refresh')
          await this.refresh()
        }
        catch (err) {
          debug('error:', err.message)
        }
      })

      this.event.on('item.view', ({ item: _item, document: doc }: { item: any, document: Document }) => {
        debug('new item viewed')
        if (this.observer) this.observer.disconnect()
        this.observer = new MutationObserver(this.itemboxmutated.bind(this) as MutationCallback)
        this.observer.observe(doc.getElementById('zotero-editpane-item-box') as Node, { childList: true, subtree: true })
      })
    }

    private async refresh() {
      this.pathfinder = null
      const graph: DiGraph = {}
      for (const {v, w} of (await Zotero.DB.queryAsync(this.query))) {
        graph[v] = graph[v] || {}
        graph[v][w] = 1

        graph[w] = graph[w] || {}
        graph[w][v] = 1
      }
      debug('graph refreshed')
      this.graph = graph
    }

    private async notify(_action: any, _type: any, _ids: any[], _extraData: any) {
      await this.refresh()
    }

    private creator(creator: Creator): string {
      const name = creator.fieldMode === 1 ? creator.lastName : `${creator.lastName}, ${creator.firstName}`
      return name.trim()
    }

    private creatorID(creator: Creator): string {
      // "fieldMode":0,"firstName":"Saharon","lastName":"Shelah"
      const name = creator.fieldMode === 1 ? creator.lastName : `${creator.lastName}\t${creator.firstName}`
      const id = `C\t${name}`
      return id
    }
    protected setStart(creator: Creator) {
      const id = this.creatorID(creator)
      this.pathfinder = new Dijkstra(this.graph, id)
      this.start = this.creator(creator)
    }
    protected setEnd(creator: Creator) {
      const id = this.creatorID(creator)
      alert(`distance=${this.pathfinder.distance(id)}`)
    }

    protected itemboxmutated(mutations: MutationRecord[], _observer: MutationObserver): void {
      let id: string
      for (const mutation of mutations) {
        const node = mutation.target as Element
        if (mutation.type === 'childList' && (id = node.getAttribute('id'))) {
          if (id === 'creator-type-menu') {
            if (this.graph && !node.querySelector('#erdos-start')) {
              node.appendChild(node.ownerDocument.createElement('menuseparator'))
              const menuitem = node.appendChild(node.ownerDocument.createElement('menuitem'))
              menuitem.setAttribute('id', 'erdos-start')
              menuitem.setAttribute('label', 'Start of Erdos trail')
              menuitem.setAttribute('oncommand', `
                var typeBox = document.popupNode.localName == 'hbox' ? document.popupNode : document.popupNode.parentNode;
                var index = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
                var item = document.getBindingParent(this).item;
                var exists = item.hasCreatorAt(index);
                if (exists) Zotero.Erdos.setStart(item.getCreator(index));
                return false;
              `)
            }
            if (this.start && !node.querySelector('#erdos-end')) {
              const menuitem = node.appendChild(node.ownerDocument.createElement('menuitem'))
              menuitem.setAttribute('id', 'erdos-end')
              menuitem.setAttribute('label', `Path to ${this.start}`)
              menuitem.setAttribute('oncommand', `
                var typeBox = document.popupNode.localName == 'hbox' ? document.popupNode : document.popupNode.parentNode;
                var index = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
                var item = document.getBindingParent(this).item;
                var exists = item.hasCreatorAt(index);
                if (exists) Zotero.Erdos.setEnd(item.getCreator(index));
                return false;
              `)
            }
          }
        }
      }
    }
  }

  Zotero.Erdos = new Erdos
}
