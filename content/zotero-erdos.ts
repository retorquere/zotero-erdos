declare const Zotero: any
// declare const Components: any

import { debug } from './debug'
import { EventEmitter2 as EventEmitter } from 'eventemitter2'
import { DiGraph, Dijkstra } from './dijkstra'


type Creator = { fieldMode: number, firstName?: string, lastName: string }

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
    private query: { graph: string, items: string }
    private start: string
    protected report: { creator1: string, creator2: string, title: string, select: string }[][]

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
          this.query = {
            graph: Zotero.File.getContentsFromURL('resource://zotero-erdos/graph.sql').replace(/[\r\n]/g, ' '),
            items: Zotero.File.getContentsFromURL('resource://zotero-erdos/items.sql').replace(/[\r\n]/g, ' '),
          }
          debug('queries loaded')
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
      for (const {v, w} of (await Zotero.DB.queryAsync(this.query.graph))) {
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

    private creator(creator: Creator | string): string {
      if (typeof creator === 'string') {
        try {
          creator = Zotero.Creators.get(creator) as Creator
        }
        catch (err) {
          debug('error getting', creator, err.message)
          creator = { fieldMode: 1, lastName: creator } as Creator
        }
      }
      return creator.fieldMode === 1 || !creator.firstName ? creator.lastName : `${creator.lastName}, ${creator.firstName}`
    }

    protected async setStart(creator: Creator) {
      try {
        const id = await Zotero.Creators.getIDFromData(creator)
        if (id) {
          this.pathfinder = new Dijkstra(this.graph, `C${id}`)
          this.start = this.creator(creator)
        }
        else {
          this.pathfinder = null
        }
      }
      catch (err) {
        debug('setStart error:', err.message)
      }
    }

    protected async setEnd(creator: Creator) {
      try {
        const id: string = await Zotero.Creators.getIDFromData(creator)
        if (id) {
          // path = (src) - I - C - I - C ....
          const paths: string[][] = this.pathfinder.paths(`C${id}`).filter(path => path.length > 2)
          if (!paths.length) return
          const vertices = paths.flat()

          const itemIDs = vertices.filter(v => v[0] === 'I').map(i => i.substr(1)).join(',')
          const items: Record<string, { title: string, select: string }> = {}
          for (const { itemID, title, itemKey, libraryID } of (await Zotero.DB.queryAsync(`${this.query.items} WHERE itemID IN (${itemIDs})`))) {
            items[`I${itemID}`] = {
              title,
              select: libraryID === Zotero.Libraries.userLibraryID ? `zotero://select/library/items/${itemKey}` : `zotero://select/groups/${libraryID}/items/${itemKey}`,
            }
          }

          const creators: Record<string, string> = vertices.filter(v => v[0] === 'C').reduce((acc, c) => { acc[c] = this.creator(c.substr(1)); return acc }, {})

          this.report = []
          for (const path of paths) {
            this.report.unshift([])
            for (let i = 0; i < paths.length - 2; i += 2) {
              this.report[0].push({
                creator1: creators[path[i]],
                ...items[path[i + 1]],
                creator2: creators[path[i + 2]],
              })
            }
          }
        }
        else {
          alert(`could not find ${JSON.stringify(creator)}`)
        }
      }
      catch (err) {
        debug('setEnd error:', err.message)
      }
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
                if (exists) {
                  Zotero.Erdos.setStart(item.getCreator(index));
                  const end = document.getElementById('erdos-end');
                  if (end) end.remove()
                }

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
