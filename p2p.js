const crypto = require('crypto');
const Swarm = require('discovery-swarm');
const defaults = require('dat-swarm-defaults');
const getPort = require('get-port');
const chain =  require("./chain");
const CronJob = require('cron').CronJob;
const express = require("express");
const bodyParser = require('body-parser');
const wallet = require('./wallet');

// Set your variables to hold an object with the peers and connection sequence
const peers = {};
let connSeq = 0;

let channel = 'myBlockchain';
let registeredMiners = [];
let lastBlockMinedBy = null;


// define a message type to request and receive the latest block
let MessageType = {
    REQUEST_BLOCK: 'requestBlock',
    RECEIVE_NEXT_BLOCK: 'receiveNextBlock',
    RECEIVE_NEW_BLOCK: 'receiveNewBlock',
    REQUEST_ALL_REGISTER_MINERS: 'requestAllRegisterMiners',
    REGISTER_MINER: 'registerMiner'
};

const myPeerId = crypto.randomBytes(32);
console.log('myPeerId: ' + myPeerId.toString('hex'));

// create a database once you start the code
chain.createDb(myPeerId.toString('hex'));


// create a method called initHttpServer that will initiate the server and create the services
let initHttpServer = (port) => {
    let http_port = '80' + port.toString().slice(-2);
    let app = express();
    app.use(bodyParser.json());

    //  Blocks service will be retrieving all of your blocks
    app.get('/blocks', (req, res) => res.send(JSON.stringify( chain.blockchain )));

    // getBlock service will be retrieving one block based on an index
    app.get('/getBlock', (req, res) => {
        let blockIndex = req.query.index;
        res.send(chain.blockchain[blockIndex]);
    });

    //  getDBBlock service will be retrieving a LevelDB database entry based on an index
    app.get('/getDBBlock', (req, res) => {
        let blockIndex = req.query.index;
        chain.getDbBlock(blockIndex, res);
    });

    //getWallet service will be utilizing the wallet.js file you created in the previous step and generate your public-private key pair
    app.get('/getWallet', (req, res) => {
        res.send(wallet.initWallet());
    });
    app.listen(http_port, () => console.log('Listening http on port: ' + http_port));
};

// generate a config object that holds your peer ID
const config = defaults({
    id: myPeerId,
});

// initialize swarm library using config as object
const swarm = Swarm(config);
   
(async () => {
    // listen on the random port selected
    const port = await getPort();

    initHttpServer(port); // call the initHttpServer

    swarm.listen(port);
    console.log('Listening port: ' + port);

    swarm.join(channel);
    swarm.on('connection', (conn, info) => {
        const seq = connSeq;
        const peerId = info.id.toString('hex');
        console.log(`Connected #${seq} to peer: ${peerId}`);
        if (info.initiator) {
            try {
                // use setKeepAlive to ensure the network connection stays with other peers
                conn.setKeepAlive(true, 600);
            } catch (exception) {
                console.log('exception', exception);
            }
        }

        // Once you receive a data message on the P2P network, you parse the data using JSON.parse
        conn.on('data', data => {
            let message = JSON.parse(data);
            console.log('----------- Received Message start -------------');
            console.log(
                'from: ' + peerId.toString('hex'),
                'to: ' + peerId.toString(message.to),
                'my: ' + myPeerId.toString('hex'),
                'type: ' + JSON.stringify(message.type)
            );
            console.log('----------- Received Message end -------------');

            /* 
              once a connection data event message is received, you can create your switch 
              code to handle the different types of requests
            */
            switch (message.type) {
                case MessageType.REQUEST_BLOCK:
                    console.log('-----------REQUEST_BLOCK-------------');
                    let requestedIndex = (JSON.parse(JSON.stringify(message.data))).index;
                    let requestedBlock = chain.getBlock(requestedIndex);
                    if (requestedBlock)
                    writeMessageToPeerToId(peerId.toString('hex'), MessageType.RECEIVE_NEXT_BLOCK, requestedBlock);
                    else
                        console.log('No block found @ index: ' + requestedIndex);
                    console.log('-----------REQUEST_BLOCK-------------');
                    break;

                case MessageType.RECEIVE_NEXT_BLOCK:
                    console.log('-----------RECEIVE_NEXT_BLOCK-------------');
                    chain.addBlock(JSON.parse(JSON.stringify(message.data)));
                    console.log(JSON.stringify(chain.blockchain));
                    let nextBlockIndex = chain.getLatestBlock().index+1;
                    console.log('-- request next block @ index: ' + nextBlockIndex);
                    writeMessageToPeers(MessageType.REQUEST_BLOCK, {index: nextBlockIndex});
                    console.log('-----------RECEIVE_NEXT_BLOCK-------------');
                    break;

                case MessageType.RECEIVE_NEW_BLOCK:
                    if ( message.to === myPeerId.toString('hex') && message.from !== myPeerId.toString('hex')) {
                        console.log('-----------RECEIVE_NEW_BLOCK------------- ' + message.to);
                        chain.addBlock(JSON.parse(JSON.stringify(message.data)));
                        console.log(JSON.stringify(chain.blockchain));
                        console.log('-----------RECEIVE_NEW_BLOCK------------- ' + message.to);
                    }
                    break;

                case MessageType.REQUEST_ALL_REGISTER_MINERS:
                    console.log('-----------REQUEST_ALL_REGISTER_MINERS------------- ' + message.to);
                    writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
                    registeredMiners = JSON.parse(JSON.stringify(message.data));
                    console.log('-----------REQUEST_ALL_REGISTER_MINERS------------- ' + message.to);
                    break;

                case MessageType.REGISTER_MINER:
                    console.log('-----------REGISTER_MINER------------- ' + message.to);
                    let miners = JSON.stringify(message.data);
                    registeredMiners = JSON.parse(miners);
                    console.log(registeredMiners);
                    console.log('-----------REGISTER_MINER------------- ' + message.to);
                    break;
            }

        });

       /*  
         listen to a close event, which will indicate that you 
         lost a connection with peers, so you can take action, such as delete
         the peers from your peers ist object. 
       */
        conn.on('close', () => {
           console.log(`Connection ${seq} closed, peerId: ${peerId}`);
            if (peers[peerId].seq === seq) {
                delete peers[peerId];
                console.log('--- registeredMiners before: ' + JSON.stringify(registeredMiners));
                let index = registeredMiners.indexOf(peerId);
                if (index > -1)
                    registeredMiners.splice(index, 1);
                console.log('--- registeredMiners end: ' + JSON.stringify(registeredMiners));
            }
        });

        if (!peers[peerId]) {
            peers[peerId] = {}
        }
        peers[peerId].conn = conn;
        peers[peerId].seq = seq;
        connSeq++
    })
})();

// writeMessageToPeers method will be sending messages to all the connected peers
writeMessageToPeers = (type, data) => {
    for (let id in peers) {
        console.log('-------- writeMessageToPeers start -------- ');
        console.log('type: ' + type + ', to: ' + id);
        console.log('-------- writeMessageToPeers end ----------- ');
        sendMessage(id, type, data);
    }
};

// writeMessageToPeerToId, that will be sending the message to a specific peer ID
writeMessageToPeerToId = (toId, type, data) => {
    for (let id in peers) {
        if (id === toId) {
            console.log('-------- writeMessageToPeerToId start -------- ');
            console.log('type: ' + type + ', to: ' + toId);
            console.log('-------- writeMessageToPeerToId end ----------- ');
            sendMessage(id, type, data);
        }
    }
};

/* 
   sendMessage is a generic method that we will be using to send a
   message formatted with the params you would like to pass and includes the
   following:
     – to/from: The peer ID you are sending the message from and to
     – type: The message type
     – data: Any data you would like to share on the P2P network 
*/

sendMessage = (id, type, data) => {
    peers[id].conn.write(JSON.stringify(
        {
            to: id,
            from: myPeerId,
            type: type,
            data: data
        }
    ));
};

setTimeout(function(){
    writeMessageToPeers(MessageType.REQUEST_ALL_REGISTER_MINERS, null);
}, 5000);

// using a setTimeout function to send a message send a request to retrieve the latest block every 5 seconds
setTimeout(function(){
    writeMessageToPeers(MessageType.REQUEST_BLOCK, {index: chain.getLatestBlock().index+1});
}, 5000);

setTimeout(function(){
    registeredMiners.push(myPeerId.toString('hex'));
    console.log('----------Register my miner --------------');
    console.log(registeredMiners);
    writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
    console.log('---------- Register my miner --------------');
}, 7000);


const job = new CronJob('30 * * * * *', function() {
    let index = 0; // first block

    // requesting next block from your next miner
    if (lastBlockMinedBy) {
        let newIndex = registeredMiners.indexOf(lastBlockMinedBy); 
        index = ( newIndex+1 > registeredMiners.length-1) ? 0 : newIndex + 1;
    }

    /*
      To generate and add a new block, you will be calling chain
      generateNextBlock and addBlock. Lastly, you will broadcast the new
      block to all the connected peers.
    */
    lastBlockMinedBy = registeredMiners[index];
    console.log('-- REQUESTING NEW BLOCK FROM: ' + registeredMiners[index] + ', index: ' + index);
    console.log(JSON.stringify(registeredMiners));
    if (registeredMiners[index] === myPeerId.toString('hex')) {
        console.log('-----------create next block -----------------');
        let newBlock = chain.generateNextBlock(null);
        chain.addBlock(newBlock);
        console.log(JSON.stringify(newBlock));
        writeMessageToPeers(MessageType.RECEIVE_NEW_BLOCK, newBlock);
        console.log(JSON.stringify(chain.blockchain));
        console.log('-----------create next block -----------------');
    }
});
job.start();