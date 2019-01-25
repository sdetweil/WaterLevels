/* Magic Mirror
 * Module: MMM-Tube
 *
 * Node_helper written by sdetweil
 *  THANK YOU, Fantastic work!
 */
const NodeHelper = require('node_helper');
const request = require('request');
const path = require('path')
  zlib = require('zlib');
var moment = require('moment');
var csv = require(path.resolve(__dirname, "getCsv.js"));

module.exports = NodeHelper.create({

    start: function () {
      console.log("Starting module: " + this.name);
      self = this;
			self.lastUpdated = moment()
    },
    self: 0,
    pins_loaded: [],
    pin_index: 0,
    results: {},
    using_chartjs: true,
    suspended: false,
    timer: null,
    lastUpdated: 0,

    process_pin_history(pin, data) {
      now = moment();
      var counter = 0
        var data_array = [];
      while (counter < data.length) {
        //console.log("data.length="+data.length);
        var line = data.substring(counter, data.indexOf("\n", counter));

        counter += line.length + 1;
        //console.log("line ="+line);
        var info = line.split(',')
          //console.log("info= "+info[1]+" line="+line.length+ " dif="+moment(parseInt(info[1])).diff(now,'days'));
          // console.log("dayrange="+self.config.dayrange);
          if (moment(parseInt(info[1])).diff(now, 'days') > (-1 * parseInt(self.config.dayrange))) {
            var point = {}
            point.x = new Date(parseInt(info[1]))
              if (self.using_chartjs == false) {
                // add it to the array for this pin
                if (info[0].indexOf('.') != -1)
                  point.y = parseFloat(info[0]);
                else
                  point.y = parseInt(info[0]);
              } else {
                if (info[0].indexOf('.') != -1)
                  point.y = parseFloat(info[0]);
                else
                  point.y = (parseInt(info[0]));
              }
              data_array.push(point);
            // console.log("have info for date="+info[2]+"="+info[0])
          }
      }
      console.log("adding data for " + pin + " to results size=" + data_array.length);
      // need to keep the same data item for the chart
      self.results[pin].splice(0, self.results[pin].length, ...data_array);
    },
    getInitialData: function (url, callback) {
      console.log("getting initial data for pin=" + self.config.Pins[self.pins_loaded.length]);
      request({
        url: url + "/data/" + self.config.Pins[self.pins_loaded.length],
        encoding: null,
        headers: {
          'Accept-Encoding': 'gzip'
        },
        gzip: true,
        method: 'GET'
      }, (error, response, body) => {

        if (!error && response.statusCode === 200) {
          //var t =new String(body).substring(0,20);
          //console.log("have raw data for history for pin="+self.config.Pins[self.pins_loaded.length]+" size="+body.length +" data="+hexy.hexy(t));
          zlib.gunzip(body, function (err, dezipped) {
            //zipped=csv.getCsv(self.config.Pins[self.pins_loaded.length]);
            if (err != null)
              console.log("unzip error=" + err);
            //else
            // console.log("have csv data ="+dezipped);
            self.process_pin_history(self.config.Pins[self.pins_loaded.length], new String(dezipped))
            self.pins_loaded.push(self.config.Pins[self.pins_loaded.length])
            if (self.pins_loaded.length != self.config.Pins.length)
              self.getInitialData(url, callback)
            else
              callback(self.results);
          });
        } else if (error)
          console.log("===>error=" + JSON.stringify(error));
      });
    },

    getPinValue: function (url, pin, callback) {
      request({
        url: url + "/get/" + pin,
        method: 'GET'
      }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          callback(pin, body);
        }
      });

    },

    getPins: function (url, callback) {
      console.log("pins=" + self.config.Pins + " pins loaded=" + self.pins_loaded);
      var index = self.pins_loaded.length;
      console.log("getting data for pin= " + self.config.Pins[index]);
      self.getPinValue(self.url, self.config.Pins[index], function (pin, value) {
        console.log("have data for pin=" + pin + " value=" + value);
        self.pins_loaded.push(pin);
        // add this value on tpo the end
        var v = self.results[pin]
        var point = {}
        point.x = new Date()
            if (value.indexOf('.') != -1) {
              console.log("float value =" + parseFloat(value.substring(2, value.length - 2)));
              point.y = parseFloat(value.substring(2, value.length - 2))
            } else {
              console.log("int value =" + parseInt(value.substring(2, value.length - 2)));
              point.y = parseInt(value.substring(2, value.length - 2));
            }
        v.push(point);
        // remove 1st element
        if (v.length > 1)
          v.shift()
          self.results[pin] = v;
        if (self.pins_loaded.length != self.config.Pins.length)
          self.getPins(url, callback);
        else
          callback()
      })
    },
    doGetPins: function (init) {
      // if we are not suspended, and the last time we updated was at least the delay time,
      // then update again
			var now=moment()
			var elapsed= moment.duration(now.diff(self.lastUpdated,'minutes'))

			console.log("elapsed time since last updated="+elapsed+" init="+init);
      if ((self.suspended == false &&  elapsed>= self.config.updateInterval) || init==true) {
        self.lastUpdated = moment()
        // clear the array of current data
        //console.log("getting recent pin data");
        self.pins_loaded = [];
        // get all the pins, callback when done
        self.getPins(self.url, function () {
          // all pin data collected
          // update the display
	
          self.results.pins = self.config.Pins;
          // send the data on to the display module
          self.sendSocketNotification('PinData', self.results)
        });
      }
    },
    getData: function (init) {
      
      self.pins_loaded = [];
      self.getInitialData(self.url, function (data) {
        self.doGetPins(init);
        // start refreshing the data every few minutes
        if (self.timer == null)
          self.timer = setInterval(function(){self.doGetPins(false)}, (self.config.updateInterval * (60 * 1000)));
      });
    },
    //Subclass socketNotificationReceived received.
    socketNotificationReceived: function (notification, payload) {
      if (notification === 'CONFIG') {
        this.config = payload;
        console.log("config =" + JSON.stringify(payload));
        self.url = this.config.blynk_url + this.config.apiKey;
        for (var pin of this.config.Pins) {
          //console.log("initializing array for pin="+pin);
          self.results[pin] = [];
        }
        self.getData(true);

      } else if (notification === 'SUSPEND') {
        self.suspended = true;
      } else if (notification === 'RESUME') {
        self.suspended = false;
        self.getData(false);
      }

    },
  });