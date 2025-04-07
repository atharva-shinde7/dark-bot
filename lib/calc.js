const { evaluate, format } = require('mathjs')

async function calculate(expression) {
    try {
        const result = evaluate(expression)
        return format(result, { precision: 14 })
    } catch (error) {
        throw new Error('Invalid expression. Try something like `5 * (2 + 3)^2` or `sin(30)`.')
    }
}

module.exports = { calculate }
