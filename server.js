const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const axios = require('axios')

dotenv.config()

const app = express()

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  next()
})

app.use(cors({ origin: '*' }))
app.use(express.json())

app.get('/', (req, res) => {
    res.json({ message: 'Quantos API is running!' })
})

app.post('/analyse', async (req, res) => {
    const { name, win_rate, drawdown, worst_month, best_month, total_trades, entry_condition, exit_condition, stop_loss, target, profit_factor, sharpe_ratio, instrument, timeframe } = req.body

    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a trading coach who explains why trading strategies fail in simple plain English. Be specific, helpful and clear. No jargon.'
                    },
                    {
                        role: 'user',
                        content: `Analyse this failed trading strategy:

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
                    }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        )
        const explanation = response.data.choices[0].message.content
        res.json({ strategy: name, explanation: explanation })

    } catch (error) {
        console.error(error)
        const explanation = `Your ${name} strategy had a win rate of ${win_rate}% with a max drawdown of ${drawdown}%. The worst period was ${worst_month}. Please try again.`
        res.json({ strategy: name, explanation: explanation })
    }
})

module.exports = app