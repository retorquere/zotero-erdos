declare const Zotero: any
// declare const Components: any

import { debug } from './debug'
import { EventEmitter2 as EventEmitter } from 'eventemitter2'
import { DiGraph, Dijkstra } from './dijkstra'
const template = require('./report.pug')

type Creator = { fieldMode: number, firstName?: string, lastName: string, creatorTypeID: number }
type ReportStep = { creator: string, cocreator: string, title: string, libraryID: number, itemID: number }

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
    private started = false
    private report: string

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
          this.started = true

          // debug
          // await this.setStart({fieldMode: 0, firstName: 'James H.', lastName: 'Schmerl', creatorTypeID: 1})
          // await this.setEnd({fieldMode: 0, firstName: 'Fred', lastName: 'Galvin', creatorTypeID: 1})
        }
        catch (err) {
          debug('Error:', err.message)
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
          debug('error: getting', creator, err.message)
          creator = { fieldMode: 1, lastName: creator } as Creator
        }
      }
      return creator.fieldMode === 1 || !creator.firstName ? creator.lastName : `${creator.lastName}, ${creator.firstName}`
    }

    protected async setStart(creator: Creator) {
      debug('setStart:', creator)
      if (!this.started) {
        alert('still starting')
        return
      }

      try {
        let id: number
        await Zotero.DB.executeTransaction(async () => {
          id = await Zotero.Creators.getIDFromData(creator)
        })

        if (id) {
          this.pathfinder = new Dijkstra(this.graph, `C${id}`)
          this.start = this.creator(creator)
        }
        else {
          this.pathfinder = null
        }
      }
      catch (err) {
        debug('error: setStart', err.message)
      }
    }

    protected async setEnd(creator: Creator) {
      debug('setEnd:', creator)
      if (!this.started) {
        alert('still starting')
        return
      }

      try {
        let id: number
        await Zotero.DB.executeTransaction(async () => {
          id = await Zotero.Creators.getIDFromData(creator)
        })
        if (typeof id === 'number') {
          // path = (src) - I - C - I - C ....
          const paths: string[][] = this.pathfinder.paths(`C${id}`)
          if (!paths.length) return
          debug('paths:', paths)
          const vertices: string[] = [].concat(...paths)

          const itemIDs = vertices.filter(v => v[0] === 'I').map(i => i.substr(1)).join(',')
          const items: Record<string, { title: string, itemID: number, libraryID: number, select?: string  }> = {}
          for (const { itemID, title, libraryID } of (await Zotero.DB.queryAsync(`${this.query.items} WHERE i.itemID IN (${itemIDs})`))) {
            items[`I${itemID}`] = {
              title,
              itemID,
              libraryID,
              // select: libraryID === Zotero.Libraries.userLibraryID ? `zotero://select/library/items/${itemKey}` : `zotero://select/groups/${libraryID}/items/${itemKey}`,
            }
          }
          debug('items:', items)

          const creators: Record<string, string> = vertices.filter(v => v[0] === 'C').reduce((acc, c) => { acc[c] = this.creator(c.substr(1)); return acc }, {})
          debug('creators:', creators)

          const report: ReportStep[][] = paths.map(path => path
            // get C-I-C
            .map((_, i) => i % 2 === 0 ? path.slice(i, i+3) : undefined) // eslint-disable-line @typescript-eslint/no-magic-numbers
            // remove I-C-I and tail
            .filter(step => step && step.length === 3) // eslint-disable-line @typescript-eslint/no-magic-numbers
            .map(([cr, item, co]) => ({ creator: creators[cr], ...items[item], cocreator: creators[co] }))
          )
          debug('report:', report)
          this.report = template({ start: this.start, end: this.creator(creator), paths: report })
          debug('reporting:', this.report)

          Zotero.openInViewer('chrome://zotero-erdos/content/report.html')
        }
        else {
          alert(`could not find ${JSON.stringify(creator)}`)
        }
      }
      catch (err) {
        debug('error: setEnd', err.message, '\n', err.stack)
      }
    }

    private updateMenu(creator_type_menu) {
      if (!creator_type_menu.querySelector('#erdos-start')) {
        creator_type_menu.appendChild(creator_type_menu.ownerDocument.createElement('menuseparator'))
        const menuitem = creator_type_menu.appendChild(creator_type_menu.ownerDocument.createElement('menuitem'))
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

      if (this.start && !creator_type_menu.querySelector('#erdos-end')) {
        const menuitem = creator_type_menu.appendChild(creator_type_menu.ownerDocument.createElement('menuitem'))
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

    protected itemboxmutated(mutations: MutationRecord[], _observer: MutationObserver): void {
      if (!this.started) return

      for (const mutation of mutations) {
        const node = mutation.target as Element
        if (mutation.type === 'childList' && node.getAttribute('id') === 'creator-type-menu') this.updateMenu(node)
      }
    }
  }

  Zotero.Erdos = new Erdos
}
