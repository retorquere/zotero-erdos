declare const Zotero: any
// declare const Components: any

import { debug } from './debug'
import { EventEmitter2 as EventEmitter } from 'eventemitter2'

if (!Zotero.Erdos) {
  const monkey_patch_marker = 'ErdosMonkeyPatched'

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-inner-declarations, prefer-arrow/prefer-arrow-functions
  function patch(object, method, patcher) {
    if (object[method][monkey_patch_marker]) return
    object[method] = patcher(object[method])
    object[method][monkey_patch_marker] = true
  }

  class Erdos { // tslint:disable-line:variable-name
    private initialized = false
    private globals: Record<string, any>
    private strings: any
    private query: { nodes: string, edges: string }
    public event = new EventEmitter({ wildcard: true, delimiter: '.', ignoreErrors: false })

    private observer: MutationObserver

    constructor() {
      this.event.on('start', async ({ document: doc }) => {
        this.strings = doc.getElementById('zotero-erdos-strings')
        this.query = {
          nodes: Zotero.File.getContentsFromURL(`resource://zotero-erdos/nodes.sql`).replace(/[\r\n]/g, ' '),
          edges: Zotero.File.getContentsFromURL(`resource://zotero-erdos/edges.sql`).replace(/[\r\n]/g, ' '),
        }
        Zotero.Notifier.registerObserver(this, ['item'], 'Erdos', 1)
        await this.refresh()
      })

      this.event.on('item.view', ({ item: _item, document: doc }: { item: any, document: Document }) => {
        debug('new item viewed')
        if (this.observer) this.observer.disconnect()
        this.observer = new MutationObserver(this.itemboxmutated.bind(this) as MutationCallback)
        this.observer.observe(doc.getElementById('zotero-editpane-item-box') as Node, { childList: true, subtree: true })
      })
    }

    private async refresh() {
      this.graph = graphlib.json.read({
        options: { directed: true, multigraph: false, compound: false },
        nodes: (await Zotero.DB.query(this.query.nodes)).map(row => ({ v: row.v })),
        edges: (await Zotero.DB.query(this.query.edges)).map(row => ({ v: row.v, w: row.w })),
      })
    }

    private async notify(_action: any, _type: any, ids: any[], _extraData: any) {
      await this.refresh()
    }

    protected async itemboxmutated(mutations: MutationRecord[], _observer: MutationObserver): void {
      let id: string
      for (const mutation of mutations) {
        const node = mutation.target as Element
        if (mutation.type === 'childList' && (id = node.getAttribute('id'))) {
          if (id === 'creator-type-menu') {
            if (!node.querySelector('#erdos')) {
              node.appendChild(node.ownerDocument.createElement('menuseparator'))
              const menuitem = node.appendChild(node.ownerDocument.createElement('menuitem'))
              menuitem.setAttribute('id', 'erdos-start')
              menuitem.setAttribute('label', 'Start of Erdos trail')
            }
          }
        }
      }
    }
  }

  Zotero.Erdos = new Erdos
}
