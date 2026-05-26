const { Telegraf } = require('telegraf');
const axios = require('axios');

let bot;

// Simple conversion using a reliable free API
async function getExchangeRate(from, to, amount = 1) {
    try {
        from = from.toUpperCase().trim();
        to = to.toUpperCase().trim();
        amount = parseFloat(amount);
        
        if (isNaN(amount)) {
            throw new Error('Invalid amount');
        }
        
        // Using currency-api (very reliable, no key needed)
        const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data && response.data[from.toLowerCase()]) {
            const rate = response.data[from.toLowerCase()][to.toLowerCase()];
            if (rate) {
                return {
                    rate: rate,
                    result: amount * rate,
                    from: from,
                    to: to,
                    amount: amount
                };
            } else {
                throw new Error(`Rate not found for ${to}`);
            }
        }
        throw new Error('Invalid response from API');
    } catch (error) {
        console.error('API Error:', error.message);
        throw new Error(`Cannot convert ${from} to ${to}. Use valid codes like USD, EUR, INR, GBP`);
    }
}

// Get rates for a currency
async function getRates(baseCurrency) {
    try {
        baseCurrency = baseCurrency.toLowerCase().trim();
        const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseCurrency}.json`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data && response.data[baseCurrency]) {
            return response.data[baseCurrency];
        }
        throw new Error('No rates found');
    } catch (error) {
        throw new Error(`Cannot get rates for ${baseCurrency.toUpperCase()}`);
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
            `<b>Quick Convert:</b>\n` +
            `<code>100 USD to EUR</code>\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    botInstance.help((ctx) => {
        ctx.replyWithHTML(
            `<b>📖 How to use:</b>\n\n` +
            `<b>Convert currency:</b>\n` +
            `<code>/convert USD EUR 100</code>\n\n` +
            `<b>Get exchange rates:</b>\n` +
            `<code>/rates USD</code>\n\n` +
            `<b>Natural language:</b>\n` +
            `<code>100 USD to EUR</code>\n\n` +
            `<b>Supported codes:</b>\n` +
            `USD, EUR, GBP, INR, JPY, CAD, AUD, CHF, CNY, and 150+ more!\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    // Convert command
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
        
        const message = await ctx.reply('🔄 Converting... Please wait.');
        
        try {
            const result = await getExchangeRate(from, to, amount);
            
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                message.message_id,
                null,
                `💱 <b>Currency Conversion</b>\n\n` +
                `💰 <b>${result.amount.toFixed(2)} ${result.from}</b> = <b>${result.result.toFixed(2)} ${result.to}</b>\n` +
                `📊 Rate: 1 ${result.from} = ${result.rate.toFixed(4)} ${result.to}\n\n` +
                `<i>Powered By Introspection007</i>`,
                { parse_mode: 'HTML' }
            );
        } catch (error) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                message.message_id,
                null,
                `❌ ${error.message}\n\nTry: USD, EUR, INR, GBP, JPY, CAD`,
                { parse_mode: 'HTML' }
            );
        }
    });

    // Rates command
    botInstance.command('rates', async (ctx) => {
        const args = ctx.message.text.split(' ');
        
        if (args.length < 2) {
            return ctx.reply('❌ Usage: /rates USD\nExample: /rates INR');
        }
        
        const baseCurrency = args[1].toUpperCase();
        const message = await ctx.reply('🔄 Fetching rates... Please wait.');
        
        try {
            const rates = await getRates(baseCurrency);
            const popular = ['usd', 'eur', 'gbp', 'inr', 'jpy', 'cad', 'aud', 'chf', 'cny'];
            
            let responseText = `📊 <b>Exchange Rates (1 ${baseCurrency})</b>\n\n`;
            let hasRates = false;
            
            for (const curr of popular) {
                const upperCurr = curr.toUpperCase();
                if (rates[curr] && upperCurr !== baseCurrency) {
                    responseText += `💵 ${upperCurr}: ${rates[curr].toFixed(4)}\n`;
                    hasRates = true;
                }
            }
            
            if (!hasRates) {
                responseText = `❌ Could not find rates for ${baseCurrency}. Please check the currency code.`;
            } else {
                responseText += `\n<i>Powered By Introspection007</i>`;
            }
            
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                message.message_id,
                null,
                responseText,
                { parse_mode: 'HTML' }
            );
        } catch (error) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                message.message_id,
                null,
                `❌ Cannot get rates for ${baseCurrency}. Try USD, EUR, or INR.`,
                { parse_mode: 'HTML' }
            );
        }
    });

    // Natural language: "100 USD to EUR"
    botInstance.on('text', async (ctx) => {
        const text = ctx.message.text;
        
        if (text.startsWith('/')) return;
        
        const pattern = /(\d+(?:\.\d+)?)\s+([A-Za-z]{3})\s+to\s+([A-Za-z]{3})/i;
        const match = text.match(pattern);
        
        if (match) {
            const amount = parseFloat(match[1]);
            const from = match[2].toUpperCase();
            const to = match[3].toUpperCase();
            
            const message = await ctx.reply('🔄 Converting...');
            
            try {
                const result = await getExchangeRate(from, to, amount);
                
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    message.message_id,
                    null,
                    `💱 <b>Conversion Result</b>\n\n` +
                    `💰 <b>${result.amount.toFixed(2)} ${result.from}</b> = <b>${result.result.toFixed(2)} ${result.to}</b>\n` +
                    `📊 Rate: 1 ${result.from} = ${result.rate.toFixed(4)} ${result.to}\n\n` +
                    `<i>Powered By Introspection007</i>`,
                    { parse_mode: 'HTML' }
                );
            } catch (error) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    message.message_id,
                    null,
                    `❌ ${error.message}`,
                    { parse_mode: 'HTML' }
                );
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
