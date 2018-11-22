/**
 * @description Message, Represents a message DTO (data transfert object).
 * @author Tanga Mathieu Kaboré
 * @copyright Ecole Polytechnique de Montréal & Course LOG2420
 * @version 1.0.0
 */
class Message {

    /**
     * Create a new data transfert object (DTO) message.
     * @param {string} eventType - The event type of the message.
     * @param {string} channelId - The channel id.
     * @param {AnyObject} data - The content of the message.
     * @param {string} sender - The sender name.
     * @param {Date} timestamp - The timestamp of the message.
     */
    constructor(eventType, channelId, data, sender, timestamp) {
        this.eventType = eventType;
        this.channelId = channelId;
        this.data = data;
        this.sender = sender;
        this.timestamp = new Date();
    }
}

module.exports = Message;