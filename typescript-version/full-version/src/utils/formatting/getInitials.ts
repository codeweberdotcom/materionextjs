// Returns initials from string
export const getInitials = (string?: string | null) => {
  if (!string || typeof string !== 'string' || string.trim() === '') {
    return ''
  }
  return string.split(/\s/).reduce((response, word) => (response += word.slice(0, 1)), '')
}
