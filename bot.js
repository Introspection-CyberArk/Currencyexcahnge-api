const { Telegraf } = require('telegraf');
const axios = require('axios');

// Your exchangerate.host API key
const API_KEY = 'a979724f3443652272529c861e925dfa';
const BASE_URL = 'http://api.exchangerate.host';

// Initialize bot (will set token from environment variable)
let bot;

// Helper function to get exchange rate
async function getExchangeRate(from, to, amount = 1) {
    try {
        const response = await axios.get(`${BASE_URL}/convert`, {
            params: {
                from: from.toUpperCase(),
                to: to.toUpperCase(),
                amount: amount,
                access_key: API_KEY
            }
        });
        
        if (response.data.success) {
            return {
                rate: response.data.info.rate,
                result: response.data.result,
                from: from,
                to: to
            };
        } else {
            throw new Error(response.data.error?.info || 'Conversion failed');
        }
    } catch (error) {
        console.error('API Error:', error.message);
        throw new Error('Failed to get exchange rate. Please try again.');
    }
}

// Setup bot commands
function setupBot(botInstance) {
    // Start command
    botInstance.start((ctx) => {
        ctx.replyWithHTML(
            `🪙 <b>Currency Exchange Bot</b>\n\n` +
            `I can help you convert currencies!\n\n` +
            `<b>Commands:</b>\n` +
            `/convert USD EUR 100 - Convert 100 USD to EUR\n` +
            `/rates USD - Get exchange rates for USD\n` +
            `/help - Show this message\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    // Help command
    botInstance.help((ctx) => {
        ctx.replyWithHTML(
            `<b>📖 How to use:</b>\n\n` +
            `<b>Convert currency:</b>\n` +
            `<code>/convert USD EUR 100</code>\n` +
            `<b>Get exchange rates:</b>\n` +
            `<code>/rates USD</code>\n\n` +
            `<b>Supported currencies:</b>\n` +
            `USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, and many more!\n\n` +
            `<i>Powered By Introspection007</i>`
        );
    });

    // Convert command
    botInstance.command('convert', async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            return ctx.reply('❌ Usage: /convert <from> <to> [amount]\nExample: /convert USD EUR 100');
        }
        
        const from = args[1].toUpperCase();
        const to = args[2].toUpperCase();
        const amount = args[3] ? parseFloat(args[3]) : 1;
        
        if (isNaN(amount)) {
            return ctx.reply('❌ Invalid amount. Please enter a number.');
        }
        
        await ctx.replyWithChatAction('typing');
        
        try {
            const result = await getExchangeRate(from, to, amount);
            
            ctx.replyWithHTML(
                `💱 <b>Currency Conversion</b>\n\n` +
                `${amount} ${from} = ${result.result.toFixed(2)} ${to}\n` +
                `<i>Rate: 1 ${from} = ${result.rate.toFixed(4)} ${to}</i>\n\n` +
                `<i>Powered By Introspection007</i>`
            );
        } catch (error) {
            ctx.reply(`❌ Error: ${error.message}\n\nMake sure currency codes are valid (e.g., USD, EUR, GBP)`);
        }
    });

    // Get exchange rates for a currency
    botInstance.command('rates', async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) {
            return ctx.reply('❌ Usage: /rates <currency>\nExample: /rates USD');
        }
        
        const baseCurrency = args[1].toUpperCase();
        
        await ctx.replyWithChatAction('typing');
        
        try {
            const response = await axios.get(`${BASE_URL}/latest`, {
                params: {
                    base: baseCurrency,
                    access_key: API_KEY
                }
            });
            
            if (response.data.success) {
                const rates = response.data.rates;
                const commonCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR'];
                
                let message = `📊 <b>Exchange Rates for ${baseCurrency}</b>\n\n`;
                
                commonCurrencies.forEach(curr => {
                    if (rates[curr]) {
                        message += `${curr}: ${rates[curr].toFixed(4)}\n`;
                    }
                });
                
                message += `\n<i>Powered By Introspection007</i>`;
                
                ctx.replyWithHTML(message);
            } else {
                throw new Error('Failed to fetch rates');
            }
        } catch (error) {
            ctx.reply('❌ Failed to fetch exchange rates. Please check the currency code.');
        }
    });

    // Inline query support
    botInstance.on('inline_query', async (ctx) => {
        const query = ctx.inlineQuery.query.trim();
        
        if (!query) {
            return ctx.answerInlineQuery([]);
        }
        
        const parts = query.split(' ');
        if (parts.length >= 2) {
            const from = parts[0].toUpperCase();
            const to = parts[1].toUpperCase();
            const amount = parts[2] ? parseFloat(parts[2]) : 1;
            
            try {
                const result = await getExchangeRate(from, to, amount);
                
                const results = [{
                    type: 'article',
                    id: '1',
                    title: `${amount} ${from} = ${result.result.toFixed(2)} ${to}`,
                    description: `Rate: 1 ${from} = ${result.rate.toFixed(4)} ${to}`,
                    input_message_content: {
                        message_text: `💱 ${amount} ${from} = ${result.result.toFixed(2)} ${to}\nRate: ${result.rate.toFixed(4)}\n\nPowered By Introspection007`
                    }
                }];
                
                await ctx.answerInlineQuery(results);
            } catch (error) {
                await ctx.answerInlineQuery([]);
            }
        }
    });

    return botInstance;
}

// Webhook handler for Vercel
module.exports = async (req, res) => {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        console.error('BOT_TOKEN not set');
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

// Local development
if (process.env.NODE_ENV !== 'production') {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (BOT_TOKEN) {
        bot = new Telegraf(BOT_TOKEN);
        setupBot(bot);
        bot.launch();
        console.log('Bot is running in polling mode...');
    } else {
        console.log('Please set BOT_TOKEN environment variable');
    }
}