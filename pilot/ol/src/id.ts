const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ID_LENGTH = 20

export const generateId = (): string => {
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('')
}
