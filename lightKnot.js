#!/usr/local/bin/node

var net = require('net');

var nnl = '\r\n'; //network new line
var configuration;
var wallType = process.argv[2];

var wall = require('./wallOutput.js');




if(wallType == 'g3d2') {

	configuration = {
		tcpPort            : 1339,
		width              : 72,
		height             : 32,
		bpp                : 4,
		subpixel           : 1,
		subpixelOrder      : 'g',
		ceilingLed 		   : false,
		name               : 'g3d2',
		recordingPath      : '~/wallRecords_g3d2',
		serialDevice       : '/dev/....',
		serialSpeed        : 500000
	};

}else if(wallType == 'pentawall') {

	configuration = {
		tcpPort            : 1338,
		width              : 16,
		height             : 15,
		bpp                : 8,
		subpixel           : 3,
		subpixelOrder      : 'rrggbb',
		ceilingLed 		   : false,
		name               : 'Pentawall',
		recordingPath      : '~/wallRecords_pw',
		serialDevice       : '/dev/....',
		serialSpeed        : 500000
	};

}else{

	configuration = {
		tcpPort            : 1340,
		width              : 24,
		height             : 24,
		bpp                : 8,
		subpixel           : 3,
		subpixelOrder      : 'rrggbb',
		ceilingLed 		   : true,
		name               : 'PentawallHD',
		recordingPath      : '~/wallRecords_pwhd',
		serialDevice       : '/dev/cu.usbserial-A100DDXM',
		serialSpeed        : 500000
	};

}
//var ledWallConnection = new serialPort(configuration.serialDevice, {baudrate: configuration.serialSpeed});

//request.socket.removeAllListeners('timeout'); 

wall.init(false,configuration.serialDevice,configuration.serialSpeed);

console.log('Starting Server for '+configuration.name+' on port '+configuration.tcpPort);

var openConnections = {};
var displayBuffers = {};

var pixelSize = configuration.bpp / 4;
var frameSize = configuration.width*configuration.height*configuration.subpixel*pixelSize;


function updateCurrentPrio(){
}

function processPacket(data,connectionId)
{
	switch(parseInt(data.substr(0,2),16))
	{
		case 0:
			return 'help:'+nnl+nnl+
			'00 help'+nnl+nnl+
			'01 show configuration'+nnl+nnl+
			'02xxyy'+configuration.subpixelOrder+' set Pixel'+nnl+
			'   * xxyy == FFFF : set all pixel'+nnl+nnl+
			((configuration.ceilingLed==true) ? '02xxrrggbbww set CeilingLED '+nnl+'   * xx   == F0..F3 ; FE (all) '+nnl+nnl:'')+
			'03'+configuration.subpixelOrder+'..'+configuration.subpixelOrder+' set all '+(configuration.width*configuration.height)+' pixel'+nnl+nnl+
			'04ll set priority level 00..04 , currentLevel: '+openConnections[connectionId].priorityLevel+nnl;

		case 1:
			return  'width='+configuration.width+nnl+
					'height='+configuration.height+nnl+
					'subpixel='+configuration.subpixel+nnl+
					'bpp='+configuration.bpp+nnl+
					'name='+configuration.name+nnl+
					'subpixelOrder='+configuration.subpixelOrder+nnl+
					'ceilingLed='+configuration.ceilingLed;
		case 2:
		
			var x = parseInt(data.substr(2,2),16);
			var y = parseInt(data.substr(4,2),16);
			var r = parseInt(data.substr(6,2),16);
			var g = parseInt(data.substr(8,2),16);
			var b = parseInt(data.substr(10,2),16);

			if(isNaN(x)||isNaN(y)||isNaN(r)||isNaN(g)||isNaN(b)){
				return 'bad';
			}


			if((x == 255)&&(y==255)){
				
				//displayBuffers[openConnections[connectionId].priorityLevel] = buf;
				wall.setAllPixel(r,g,b);

			}else if ((x < 24)&&(y < 24)){
	
				//displayBuffers[openConnections[connectionId].priorityLevel] = buf;
				wall.setPixel(x,y,r,g,b);
			
			}else{
				return 'bad'
			}

			return 'ok';

		case 3:
			
			var strFrame = data.substr(2,frameSize);
	
			if(strFrame.length != frameSize)
			{
				return 'bad';
			}
	
			var buf = new Buffer(strFrame.length/2);

			for(var a = 0; a < strFrame.length/2;a++)
			{
				buf[a] = parseInt(strFrame.substr(a*2,2),16);
				if(isNaN(buf[a]))
				{
					return 'bad';
				}
			}

			displayBuffers[openConnections[connectionId].priorityLevel] = buf;

			wall.setFrame(buf);
	
			return 'ok';
		
		case 4:
				
			var targetPrio = parseInt(data.substr(2,2),16);

			if(isNaN(targetPrio) || (targetPrio > 4))
			{
				return 'bad';
			}

			openConnections[connectionId].priorityLevel = targetPrio;

			updateCurrentPrio();

			return 'ok';
		
		case 5:
			// start recodring
		case 6:
			// stop recording
		case 9:
			// subscribe to message channel
		case 10:
			// push message

		default:
			return 'bad';
	}
}


var connectionId = 0;
var server = net.createServer(function (socket) {
	socket.setNoDelay(true);
	socket.write('welcome (00+<enter> for help)'+nnl);


	openConnections[++connectionId] = {
								priorityLevel               : 2, 
								lastActivity                : Date.now(), 
								readBuffer                  : '',
								messageChannelSubscriptions : {},
								connectionSocket            : socket
							} 
	console.log('new connection '+connectionId);

	//console.log(openConnections);

	socket.setTimeout(5*60*1000, function () {
		socket.write('timeout'+nnl);
		socket.end();
	});

	socket.on('data' , function (data) {

		if(! openConnections[connectionId]){
			console.log('connection object '+connectionId+' gone');
			return;
		}

		var completeData = openConnections[connectionId].readBuffer + data.toString('ascii');

		var pos;
		while( (pos=completeData.indexOf(nnl)) != -1)
		{
			var dataToProcess = completeData.substr(0,pos);
			completeData = completeData.substr(pos+3,completeData.length);

			socket.write(processPacket(dataToProcess,connectionId)+nnl);
		}
		openConnections[connectionId].readBuffer=completeData;

	});
	
	socket.on('end' , function () {
		//cleanup
		console.log('connection '+connectionId+' closed');
		delete openConnections[connectionId];
	});

});

server.on('connection', function (e) {
	if (e.code == 'EADDRINUSE') {
		console.log('Address in use, retrying...');
		
		setTimeout(function () {
			server.close();
			server.listen(configuration.tcpPort, '::1');
		}, 1000);
	}
});


server.listen(configuration.tcpPort, '::1');


