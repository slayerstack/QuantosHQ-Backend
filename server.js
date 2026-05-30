const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const axios = require('axios')

dotenv.config()

const app = express()

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.options('*', cors())
app.use(express.json())
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  next()
})

app.get('/', (req, res) => {
    res.json({ message: 'Quantos API is running!' })
})

app.post('/analyse', async (req, res) => {
    const { name, win_rate, drawdown, worst_month, best_month, total_trades, entry_condition, exit_condition, stop_loss, target, profit_factor, sharpe_ratio, instrument, timeframe } = req.body

    try {
        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: `You are a trading coach analysing a failed trading strategy.

Strategy: ${name}
Instrument: ${instrument || 'Not specified'}
Timeframe: ${timeframe || 'Not specified'}
Win rate: ${win_rate}%
Max drawdown: ${drawdown}%
Worst month: ${worst_month}
Best month: ${best_month}
Total trades: ${total_trades}
Profit factor: ${profit_factor || 'Not specified'}
Sharpe ratio: ${sharpe_ratio || 'Not specified'}
Stop loss: ${stop_loss || 'Not specified'}%
Target: ${target || 'Not specified'}%
Entry condition: ${entry_condition || 'Not specified'}
Exit condition: ${exit_condition || 'Not specified'}

Respond in exactly this format:

WHY IT FAILED:
[3-4 sentences explaining specifically why this strategy failed]

WHAT WOULD HAVE WORKED BETTER:
[3 specific suggestions with reasons]

MARKET CONDITIONS TO AVOID:
[When not to use this strategy]

MARKET CONDITIONS WHERE IT WORKS:
[When this strategy performs well]

Use simple language. No jargon. Like explaining to a friend.`
                }]
            },
            {
                headers: {
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                }
            }
        )
        const explanation = response.data.content[0].text
        res.json({ strategy: name, explanation: explanation })

    } catch (error) {
        console.error(error)
        const explanation = `Your ${name} strategy had a win rate of ${win_rate}% with a max drawdown of ${drawdown}%. The worst period was ${worst_month}. Add Claude API credits for full AI analysis.`
        res.json({ strategy: name, explanation: explanation })
    }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`Quantos server running on port ${PORT}`)
})