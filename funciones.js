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
  * @param {string} serial
  */
const descargarPdfEImprimir = async (url, impresora, serial = "") => {
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
  * @param {string} serial
  */
const imprimirPdfEnviadoComoArchivo = async (msg, impresora, serial) => {
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
    await descargarPdfYResponderAlUsuario(urlArchivo, impresora, msg.from.id, serial);
}

/**
  * @param {string} urlArchivo
  * @param {string} impresora
  * @param {number} idChat
  */
const descargarPdfYResponderAlUsuario = async (urlArchivo, impresora, idChat, serial) => {
    let respuesta = "Impreso correctamente";
    const posibleMensajeDeError = await descargarPdfEImprimir(urlArchivo, impresora, serial);
    if (posibleMensajeDeError) {
        respuesta = "Error: " + posibleMensajeDeError;
    }
    await bot.sendMessage(idChat, respuesta.substring(0, 4096));
}
module.exports = {
    responderConImpresoras, imprimirPdfEnviadoComoArchivo, descargarPdfYResponderAlUsuario
}