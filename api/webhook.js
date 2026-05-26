const { Telegraf } = require('telegraf');
const axios = require('axios');

let bot;

// Using multiple free APIs as fallbacks
async function getExchangeRate(from, to, amount = 1) {
    const errors = [];
    
    // API 1: Frankfurter (reliable, no API key needed)
    try {
        const response = await axios.get(`https://api.frankfurter.app/latest`, {
            params: {
                from: from.toUpperCase(),
                to: to.toUpperCase(),
                amount: amount
            },
            timeout: 5000
        });
        
        if (response.data && response.data.rates) {
            const rate = response.data.rates[to.toUpperCase()];
            if (rate) {
                return {
                    rate: rate,
                    result: amount * rate,
                    from: from.toUpperCase(),
                    to: to.toUpperCase(),
                    amount: amount
                };
            }
        }
    } catch (error) {
        errors.push('Frankfurter API failed');
    }
    
    // API 2: Exchange Rate Host (fallback)
    try {
        const response = await axios.get(`https://api.exchangerate.host/convert`, {
            params: {
                from: from.toUpperCase(),
                to: to.toUpperCase(),
                amount: amount
            },
            timeout: 5000
        });
        
        if (response.data && response.data.result) {
            return {
                rate: response.data.info.rate,
                result: response.data.result,
                from: from.toUpperCase(),
                to: to.toUpperCase(),
                amount: amount
            };
        }
    } catch (error) {
        errors.push('Exchange Rate Host failed');
    }
    
    throw new Error(`Unable to convert ${from} to ${to}. Please check currency codes.`);
}

async function getRates(baseCurrency) {
    try {
        const response = await axios.get(`https://api.frankfurter.app/latest`, {
            params: { from: baseCurrency.toUpperCase() },
            timeout: 5000
        });
        
        if (response.data && response.data.rates) {
            return response.data.rates;
        }
        throw new Error('No rates found');
    } catch (error) {
        throw new Error(`Unable to get rates for ${baseCurrency}`);
    }
}

function setupBot(botInstance) {
    botInstance.start((ctx) => {
        ctx.replyWithHTML(
            `🪙 <b>Currency Exchange Bot</b>\n\n` +
            `I can help you convert currencies!\n\n` +
            `<b>Commands:</b>\n` +
            `<code>/convert USD EUR 100</code>\n` +
            `<code>/rates USD</code>\n\n` +
            `<b>Quick Convert (just type):</b>\n` +
            `<code>100 USD to EUR</code>\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    botInstance.help((ctx) => {
        ctx.replyWithHTML(
            `<b>📖 How to use:</b>\n\n` +
            `<b>Convert:</b>\n` +
            `<code>/convert USD EUR 100</code>\n` +
            `<b>OR just type:</b>\n` +
            `<code>100 USD to EUR</code>\n\n` +
            `<b>Rates:</b>\n` +
            `<code>/rates USD</code>\n\n` +
            `<b>Supported:</b> USD, EUR, GBP, INR, JPY, CAD, AUD, and more!\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    botInstance.command('convert', async (ctx) => {
        const args = ctx.message.text.split(' ');
        
        if (args.length < 3) {
            return ctx.reply('❌ Usage: /convert USD EUR 100\nExample: /convert INR USD 500');
        }
        
        let from = args[1];
        let to = args[2];
        let amount = args[3] ? parseFloat(args[3]) : 1;
        
        if (isNaN(amount)) {
            amount = 1;
        }
        
        await ctx.replyWithChatAction('typing');
        
        try {
            const result = await getExchangeRate(from, to, amount);
            ctx.replyWithHTML(
                `💱 <b>Conversion Result</b>\n\n` +
                `💰 <b>${result.amount.toFixed(2)} ${result.from}</b> = <b>${result.result.toFixed(2)} ${result.to}</b>\n` +
                `📊 Rate: 1 ${result.from} = ${result.rate.toFixed(4)} ${result.to}\n\n` +
                `<i>Powered By Introspection007</i>`
            );
        } catch (error) {
            ctx.reply(`❌ ${error.message}\n\nTry: USD, EUR, GBP, INR, JPY, CAD, AUD`);
        }
    });

    botInstance.command('rates', async (ctx) => {
        const args = ctx.message.text.split(' ');
        
        if (args.length < 2) {
            return ctx.reply('❌ Usage: /rates USD\nExample: /rates INR');
        }
        
        const baseCurrency = args[1].toUpperCase();
        
        await ctx.replyWithChatAction('typing');
        
        try {
            const rates = await getRates(baseCurrency);
            const popular = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];
            
            let message = `📊 <b>Exchange Rates (1 ${baseCurrency})</b>\n\n`;
            let count = 0;
            
            for (const curr of popular) {
                if (rates[curr] && curr !== baseCurrency) {
                    message += `💵 ${curr}: ${rates[curr].toFixed(4)}\n`;
                    count++;
                }
            }
            
            if (count === 0) {
                message = `❌ No rates found for ${baseCurrency}. Please check the currency code.`;
            } else {
                message += `\n<i>Powered By Introspection007</i>`;
            }
            
            ctx.replyWithHTML(message);
        } catch (error) {
            ctx.reply(`❌ Unable to get rates for ${baseCurrency}. Try USD, EUR, or INR.`);
        }
    });

    // Handle natural language: "100 USD to EUR"
    botInstance.on('text', async (ctx) => {
        const text = ctx.message.text;
        
        if (text.startsWith('/')) return;
        
        const pattern = /(\d+(?:\.\d+)?)\s+([A-Za-z]{3})\s+to\s+([A-Za-z]{3})/i;
        const match = text.match(pattern);
        
        if (match) {
            const amount = parseFloat(match[1]);
            const from = match[2].toUpperCase();
            const to = match[3].toUpperCase();
            
            await ctx.replyWithChatAction('typing');
            
            try {
                const result = await getExchangeRate(from, to, amount);
                ctx.replyWithHTML(
                    `💱 <b>Conversion Result</b>\n\n` +
                    `💰 <b>${result.amount.toFixed(2)} ${result.from}</b> = <b>${result.result.toFixed(2)} ${result.to}</b>\n` +
                    `📊 Rate: 1 ${result.from} = ${result.rate.toFixed(4)} ${result.to}\n\n` +
                    `<i>Powered By Introspection007</i>`
                );
            } catch (error) {
                ctx.reply(`❌ ${error.message}`);
            }
        }
    });
}

module.exports = async (req, res) => {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        return res.status(500).send('BOT_TOKEN not configured');
    }
    
    if (!bot) {
        bot = new Telegraf(BOT_TOKEN);
        setupBot(bot);
    }
    
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body, res);
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(200).send('OK');
    }
};
