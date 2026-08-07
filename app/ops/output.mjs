const colorCodes = {
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  reset: '\u001b[0m',
}

const colorEnabled = process.env.NO_COLOR === undefined
  && process.env.FORCE_COLOR !== '0'
  && (Boolean(process.env.FORCE_COLOR) || Boolean(process.stdout.isTTY))

function color(name, message) {
  if (!colorEnabled) return message
  return `${colorCodes[name]}${message}${colorCodes.reset}`
}

export const ui = {
  title(message) {
    console.log(`\n${color('cyan', `╭─ ${message}`)}`)
  },
  step(message) {
    console.log(`${color('cyan', '│')} ${message}`)
  },
  info(message) {
    console.log(`${color('cyan', 'ℹ')} ${message}`)
  },
  success(message) {
    console.log(`${color('green', '✔')} ${color('green', message)}`)
  },
  warn(message) {
    console.warn(`${color('yellow', '⚠')} ${color('yellow', message)}`)
  },
  error(message) {
    console.error(`${color('red', '✖')} ${color('red', message)}`)
  },
}

