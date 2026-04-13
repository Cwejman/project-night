export type Spec = {
  readonly ordered?: boolean
  readonly accepts?: readonly string[]
  readonly required?: readonly string[]
  readonly unique?: readonly string[]
  readonly propagate?: boolean
}

export type Chunk = {
  readonly id: string
  readonly name?: string
  readonly spec: Spec
  readonly body: Record<string, unknown>
}

export type Placement = {
  readonly chunk_id: string
  readonly scope_id: string
  readonly type: 'instance' | 'relates'
  readonly seq?: number
}

export type Commit = {
  readonly id: string
  readonly parent_id: string | null
  readonly timestamp: string
  readonly dispatch_id?: string | null
}

export type Branch = {
  readonly name: string
  readonly head: string
}

// Declaration types — input to apply

export type ChunkDeclaration = {
  readonly id?: string
  readonly name?: string
  readonly spec?: Spec
  readonly body?: Record<string, unknown>
  readonly removed?: boolean
  readonly placements?: readonly PlacementDeclaration[]
}

export type PlacementDeclaration = {
  readonly scope_id: string
  readonly type: 'instance' | 'relates'
  readonly seq?: number
  readonly removed?: boolean
}

export type Declaration = {
  readonly chunks: readonly ChunkDeclaration[]
}

// Read results

export type ChunkItem = Chunk & {
  readonly placements: readonly Placement[]
}

export type ConnectedScope = {
  readonly id: string
  readonly name?: string
  readonly shared: number
  readonly instance: number
  readonly relates: number
  readonly connections: readonly ScopeConnection[]
}

export type ScopeConnection = {
  readonly id: string
  readonly name?: string
  readonly instance: number
  readonly relates: number
}

export type ScopeResult = {
  readonly scope: readonly ChunkItem[]
  readonly head: string
  readonly chunks: {
    readonly total: number
    readonly in_scope: number
    readonly instance: number
    readonly relates: number
    readonly items: readonly ChunkItem[]
  }
  readonly connected: readonly ConnectedScope[]
}

export type ApplyResult = {
  readonly commit: Commit
  readonly chunks: readonly { readonly id: string; readonly created: boolean }[]
}
