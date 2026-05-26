const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const axios = require('axios')
const multer = require('multer')
const fs = require('fs')

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ dest: 'uploads/' })

app.get('/', (req, res) => {
    res.json({ message: 'Quantos API is running!' })
})

// Manual input route
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
        const explanation = `Your ${name} strategy had a win rate of ${win_rate}% with a max drawdown of ${drawdown}%. The worst period was ${worst_month}. Add Claude API credits for full AI analysis.`
        res.json({ strategy: name, explanation: explanation })
    }
})

// CSV upload route
app.post('/upload-csv', upload.single('csv'), async (req, res) => {
    try {
        const filePath = req.file.path
        const content = fs.readFileSync(filePath, 'utf8')
        const lines = content.trim().split('\n')
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        
        const trades = []
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',')
            const trade = {}
            headers.forEach((h, j) => {
                trade[h] = values[j] ? values[j].trim() : ''
            })
            trades.push(trade)
        }

        // Find PnL column
        const pnlKey = headers.find(h => h.includes('pnl') || h.includes('profit') || h.includes('return') || h.includes('p&l'))
        const dateKey = headers.find(h => h.includes('date') || h.includes('time'))

        if (!pnlKey) {
            res.json({ error: 'Could not find PnL column in CSV. Make sure your CSV has a PnL or Profit column.' })
            return
        }

        // Calculate metrics
        const pnls = trades.map(t => parseFloat(t[pnlKey]) || 0)
        const totalTrades = pnls.length
        const winningTrades = pnls.filter(p => p > 0).length
        const winRate = Math.round((winningTrades / totalTrades) * 100)
        
        // Calculate drawdown
        let peak = 0
        let maxDrawdown = 0
        let cumulative = 0
        pnls.forEach(pnl => {
            cumulative += pnl
            if (cumulative > peak) peak = cumulative
            const drawdown = peak - cumulative
            if (drawdown > maxDrawdown) maxDrawdown = drawdown
        })

        // Profit factor
        const totalWins = pnls.filter(p => p > 0).reduce((a, b) => a + b, 0)
        const totalLosses = Math.abs(pnls.filter(p => p < 0).reduce((a, b) => a + b, 0))
        const profitFactor = totalLosses > 0 ? Math.round((totalWins / totalLosses) * 100) / 100 : 0

        // Best and worst month
        let bestMonth = 'N/A'
        let worstMonth = 'N/A'
        
        if (dateKey) {
            const monthlyPnl = {}
            trades.forEach((t, i) => {
                const dateStr = t[dateKey]
                if (dateStr) {
                    const date = new Date(dateStr)
                    if (!isNaN(date)) {
                        const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' })
                        monthlyPnl[monthKey] = (monthlyPnl[monthKey] || 0) + pnls[i]
                    }
                }
            })
            if (Object.keys(monthlyPnl).length > 0) {
                bestMonth = Object.keys(monthlyPnl).reduce((a, b) => monthlyPnl[a] > monthlyPnl[b] ? a : b)
                worstMonth = Object.keys(monthlyPnl).reduce((a, b) => monthlyPnl[a] < monthlyPnl[b] ? a : b)
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath)

        res.json({
            total_trades: totalTrades,
            win_rate: winRate,
            drawdown: Math.round(maxDrawdown),
            profit_factor: profitFactor,
            best_month: bestMonth,
            worst_month: worstMonth,
            total_pnl: Math.round(pnls.reduce((a, b) => a + b, 0))
        })

    } catch (error) {
        console.error(error)
        res.json({ error: 'Could not process CSV file. Please check the format.' })
    }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`Quantos server running on port ${PORT}`)
})