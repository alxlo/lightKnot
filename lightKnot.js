#!/usr/local/bin/node

/*
 * todo
 * - prio buffers allways have transparency
 * - completely disconnect wall drawing from bufferupdates (async) 
 * - throttle all connections to max wall speed
 */

var colors = require('colors');
var fs = require('fs');

var myFile = process.argv[1];
fs.watch(myFile, function (event, filename) {
	console.log('file event : terminate ' + event);
	process.exit(0);
});

process.on('uncaughtException', function (err) {

	console.log('uncaught exception: '+ err)
	console.log(err.stack);

});

var wall = require('./wall.js');
var wallConn = require('./wallConnection.js');


{
	console.log("Welcome to lightKnot".bold + " - Serving LED walls and lights since 2012");

	//var serialDevice1 = '/dev/cu.usbserial-A8008I0K';
	var serialDevice1 = '/dev/ttyUSB0';
	//var serialDevice1 = '/dev/cu.usbserial-A100DDXG';
	//var serialDevice = '/dev/cu.usbserial-A8008I0K';
		
	var hardwareAvailable = true;


	//TODO iterate over an array of serial device candidates using a for loop with break


	try{
		var stats = fs.lstatSync(serialDevice1);
		console.log("running with hardware on " + serialDevice1);
//		fs.watch(serialDevice1, function (event, filename) {
//			console.log('file event2 : terminate ' + event);
//			process.exit(0);
//		});
	} catch(e) {
		hardwareAvailable = false;
		console.log(("hardware not found on " + serialDevice1 + " - running without hardware").yellow );
		
		setInterval(function(){
			fs.lstat(serialDevice1,function(err,stats){
				if(stats && stats.dev)
				{
					console.log('restart a');
					process.exit(0);
				}
			});	
		},5000);
	}

	var dataInjectorConnection = new wallConn.newConn(hardwareAvailable,serialDevice1,500000);

	var pentawallHD = wall.newWall('PentawallHD',dataInjectorConnection);
	var ceilingLED = wall.newWall('CeilingLED',dataInjectorConnection);
	var ceilingLED = wall.newWall('Ledbar',dataInjectorConnection);
}


