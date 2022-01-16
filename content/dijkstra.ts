/* ****************************************************************************
 * Created 2008-08-19.
 *
 * Dijkstra path-finding functions. Adapted from the Dijkstar Python project.
 *
 * Copyright (C) 2008
 *   Wyatt Baldwin <self@wyattbaldwin.com>
 *   All rights reserved
 * Copyright (C) 2022
 *   Emiliano Heyns <Emiliano.Heyns@iris-advies.com>
 *   All rights reserved
 *
 * Licensed under the MIT license.
 *
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *****************************************************************************/

import nanoq = require('nanoq')

// vertex points to neighbour points to cost
export type DiGraph = Record<string, Record<string, number>>

export class Dijkstra {
  // Predecessor map for each vertex that has been encountered.
  // vertex ID => predecessor vertex ID
  private predecessors: Record<string, string[]> = {}
  // Costs of shortest paths from s to all vertices encountered.
  // vertex ID => cost
  private costs: Record<string, number> = {}

  constructor(graph: DiGraph, src: string) {
    this.costs[src] = 0

    // Costs of shortest paths from s to all vertices encountered; differs from
    // `costs` in that it provides easy access to the vertex that currently has
    // the known shortest path from s.
    // XXX: Do we actually need both `costs` and `open`?
    const open = new PriorityQueue
    open.push(src, 0)

    while (!open.empty()) {
      // In the vertices remaining in graph that have a known cost from s,
      // find the vertex, u, that currently has the shortest path from s.
      const { vertex: u, cost: cost_of_s_to_u } = open.pop()

      // Get vertices adjacent to u and explore the edges that connect u to those vertices, updating
      // the cost of the shortest paths to any or all of those vertices as
      // necessary. v is the vertice across the current edge from u.
      for (const [v, cost_of_e] of Object.entries(graph[u] || {})) {
        // Cost of s to u plus the cost of u to v across e--this is *a*
        // cost from s to v that may or may not be less than the current
        // known cost to v.
        const cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e

        // If we haven't visited v yet OR if the current known cost from s to
        // v is greater than the new cost we just found (cost of s to u plus
        // cost of u to v across e), update v's cost in the cost list and
        // update v's predecessor in the predecessor list (it's now u).
        const cost_of_s_to_v = this.costs[v]
        const first_visit = (typeof this.costs[v] === 'undefined')
        if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
          this.costs[v] = cost_of_s_to_u_plus_cost_of_e
          open.push(v, cost_of_s_to_u_plus_cost_of_e)
          this.predecessors[v] = [u]
        }
        else if (cost_of_s_to_v === cost_of_s_to_u_plus_cost_of_e) {
          this.predecessors[v].push(u)
        }
      }
    }
  }

  public reachable(dst: string): boolean {
    return typeof this.costs[dst] === 'number'
  }

  public distance(dst: string): number {
    return this.costs[dst]
  }

  private extract_paths(paths: string[][], path: number) {
    const head = paths[path][0]
    const head_pred = this.predecessors[head]
    if (!head_pred || head_pred.length === 0) return

    const history = head_pred.length > 1 ? paths[path].slice() : []

    let add = false
    for (const pred of head_pred) {
      if (add) {
        path = paths.length
        paths.push(history.slice())
      }
      paths[path].unshift(pred)
      this.extract_paths(paths, path)
      add = true
    }
  }

  public paths(dst: string): string[][] {
    if (!this.reachable(dst)) throw new Error(`${JSON.stringify(dst)} is not reachable`)
    const paths: string[][] = [[dst]]
    this.extract_paths(paths, 0)
    for (const path of paths) {
      path.reverse()
    }
    return paths
  }
}

/**
 * Priority queue implementation.
 */
class PriorityQueue {
  private queue: any
  private priorities: Record<string, number>

  constructor() {
    this.queue = new nanoq(null, this.compare.bind(this))
    this.priorities = {}
  }

  compare(v, w) {
    return this.priorities[v] - this.priorities[w]
  }

  /**
   * Add a new item to the queue and ensure the highest priority element
   * is at the front of the queue.
   */
  push(vertex, cost) {
    this.priorities[vertex] = cost
    this.queue.push(vertex)
  }

  /**
   * Return the highest priority element in the queue.
   */
  pop(): { vertex: string, cost: number } {
    const vertex = this.queue.pop() as string
    const cost = this.priorities[vertex]
    delete this.priorities[vertex]

    return { vertex, cost }
  }

  empty() {
    return this.queue.length() === 0
  }
}

/*
const dst = 'C3'
const src = 'C2'

const edges = require('./edges.json')

const graph: DiGraph = {}
for (let [v, w] of edges) {
  graph[v] = graph[v] || {}
  graph[v][w] = 1

  graph[w] = graph[w] || {}
  graph[w][v] = 1
}
console.log((new Dijsktra(graph, src)).paths(dst))
*/
