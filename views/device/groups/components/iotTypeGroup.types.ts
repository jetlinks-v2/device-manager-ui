export interface TypeGroupMeta {
  code: string
  sortIndex: number
}

export interface CreateTypeGroupInput extends TypeGroupMeta {
  name: string
  description: string
}

export interface EditTypeGroupModel extends CreateTypeGroupInput {
  id: string
}
