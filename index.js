require("dotenv").config();
const fs = require("node:fs");
const nombreArchivoPreferencias = "impresoras.json";
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const serial = process.env.LICENCIA_PLUGIN;
let idsUsuarioConImpresoraPreferida = {};

fs.readFile(nombreArchivoPreferencias, (err, data) => {
    if (err) {
        return;
    }
    idsUsuarioConImpresoraPreferida = JSON.parse(data.toString());
})

const guardarPreferencias = (cb) => {
    fs.writeFile(nombreArchivoPreferencias, JSON.stringify(idsUsuarioConImpresoraPreferida), cb);
}
const obtenerVersion = async () => {
    try {
        const urlInvocacion = `http://localhost:8080/version`;
        const httpResponse = await fetch(urlInvocacion);
        return await httpResponse.json();
    } catch (e) {
        return e.message;
    }
}
const obtenerImpresoras = async () => {
    try {
        const urlInvocacion = `http://localhost:8080/impresoras`;
        const httpResponse = await fetch(urlInvocacion);
        return await httpResponse.json();
    } catch (e) {
        return e.message;
    }
}
/**
  * @param {string} url
  * @param {string} impresora
  */
const descargarPdfEImprimir = async (url, impresora) => {
    try {
        const urlInvocacion = `http://localhost:8080/url?urlPdf=${encodeURIComponent(url)}&impresora=${encodeURIComponent(impresora)}&serial=${serial}`;
        const httpResponse = await fetch(urlInvocacion);
        return await httpResponse.json();
    } catch (e) {
        return e.message;
    }
}
/**
  * @param {number} idChat
  */
const responderConImpresoras = async (idChat) => {
    const impresoras = await obtenerImpresoras();
    if (Array.isArray(impresoras)) {
        const botonesPorFila = 3;
        const botonesBidimensionales = [];
        for (let i = 0; i < impresoras.length; i += botonesPorFila) {
            const filaDeBotones = impresoras.slice(i, i + botonesPorFila);
            botonesBidimensionales.push(filaDeBotones.map(nombreImpresora => ({ text: nombreImpresora, callback_data: nombreImpresora })));
        }
        const teclado = {
            reply_markup: {
                inline_keyboard: botonesBidimensionales,
                resize_keyboard: true,
                one_time_keyboard: true
            }
        };
        await bot.sendMessage(idChat, 'Elige la impresora:', teclado);
    } else {
        await bot.sendMessage(idChat, "Error obteniendo impresoras: " + impresoras);
    }
}
/**
  * @param {TelegramBot.Message} msg
  * @param {string} impresora
  */
const imprimirPdfEnviadoComoArchivo = async (msg, impresora) => {
    const idArchivo = msg.document.file_id;
    const descripcion = msg.caption;
    if (descripcion) {
        impresora = descripcion;
        return;
    }
    const archivo = await bot.getFile(idArchivo);
    const urlArchivo = `https://api.telegram.org/file/bot${token}/${archivo.file_path}`;
    /*
    const httpResponse = await fetch(fileUrl);
    if (httpResponse.status !== 200) {
        bot.sendMessage(chatId, "Error descargando archivo");
        return;
    }
    await fs.writeFile("test.pdf", Buffer.from(await httpResponse.arrayBuffer()))

    */
    await descargarPdfYResponderAlUsuario(urlArchivo, impresora, msg.from.id);
}

/**
  * @param {string} urlArchivo
  * @param {string} impresora
  * @param {number} idChat
  */
const descargarPdfYResponderAlUsuario = async (urlArchivo, impresora, idChat) => {
    let respuesta = "Impreso correctamente";
    const posibleMensajeDeError = await descargarPdfEImprimir(urlArchivo, impresora);
    if (posibleMensajeDeError) {
        respuesta = "Error: " + posibleMensajeDeError;
    }
    await bot.sendMessage(idChat, respuesta.substring(0, 4096));
}

const mostrarAyuda = async (idChat) => {
    await bot.sendMessage(idChat, `*Configurando plugin*
1. Necesitas ejecutar el plugin y configurarlo como se indica en: https://parzibyte.me/blog/2024/05/02/imprimir-pdf-bot-telegram/
2. Luego, elige tu impresora predeterminada con /impresoras, solo necesitas hacerlo una vez y a partir de ahí se usará la misma impresora para todas las operaciones

*Modo de uso*

- Envía un PDF como archivo y será impreso automáticamente. Puedes indicar el nombre de la impresora en la descripción del archivo y tomará precedencia al de la impresora predeterminada
- Envía un enlace de un PDF y será impreso automáticamente

También puedes usar los siguientes comandos: 
/impresoras elige la impresora preferida para el usuario
/version muestra la versión del plugin. Útil para conocer el estado de ejecución del plugin
/ayuda muestra este mensaje de ayuda`, { parse_mode: "Markdown" });
}
bot.on('callback_query', (query) => {
    const idChat = query.message.chat.id;
    const impresoraSeleccionada = query.data;
    const idUsuario = query.from.id;
    idsUsuarioConImpresoraPreferida[idUsuario] = impresoraSeleccionada;
    guardarPreferencias(() => {
        bot.sendMessage(idChat, `Tu impresora preferida es ahora '${impresoraSeleccionada}'`);
    });
});

bot.on('message', async (msg) => {
    const idChat = msg.chat.id;
    const idUsuario = msg.from.id;
    if (!idsUsuarioConImpresoraPreferida[idUsuario]) {
        bot.sendMessage(idChat, "Para imprimir, necesitas seleccionar una impresora");
        await responderConImpresoras(idChat);
        return;
    }
    const impresoraPreferida = idsUsuarioConImpresoraPreferida[idUsuario];
    if (msg.text) {
        if (msg.text.startsWith("/impresoras")) {
            await responderConImpresoras(idChat);
            return;
        } else if (msg.text.startsWith("http")) {
            await bot.sendMessage(idChat, `Imprimiendo PDF a partir de URL en ${impresoraPreferida}...`);
            await descargarPdfYResponderAlUsuario(msg.text, impresoraPreferida, idChat);
        } else if (msg.text.startsWith("/version")) {
            await bot.sendMessage(idChat, JSON.stringify(await obtenerVersion()));
        } else if (msg.text.startsWith("/ayuda")) {
            await mostrarAyuda(idChat);
        } else {
            await mostrarAyuda(idChat);
        }
    } else if (msg.document) {
        await bot.sendMessage(idChat, `Descargando e imprimiendo PDF en ${impresoraPreferida}...`);
        await imprimirPdfEnviadoComoArchivo(msg, impresoraPreferida);
    }
});