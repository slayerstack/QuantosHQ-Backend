const express = require('express')
const router = express.Router()

router.post('/', (req, res) => {
    const { name, win_rate, drawdown, worst_month, best_month, total_trades } = req.body
    
    const explanation = `Your ${name} strategy had a win rate of ${win_rate}% which means it lost more trades than it won. The worst period was ${worst_month} with a max drawdown of ${drawdown}%. Consider testing this strategy in different market conditions.`
    
    res.json({
        strategy: name,
        explanation: explanation
    })
})

module.exports = router


