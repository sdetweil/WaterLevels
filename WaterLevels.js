/* Magic Mirror
 * Module: MMM-BMW-DS
 * By Mykle1
 * MIT Licensed
 */
var self;
Module.register("WaterLevels", {

  // Module config defaults.
  defaults: {
    apiKey: "", // Get FREE API key from darksky.net
    Pins: [],
    maxWidth: 800,
    width: 400,
    height: 400,
    updateInterval: 5,
    blynk_url: "http://blynk-cloud.com/",
    dayrange: 7,
    pinLimits: [0,1800],
    skipInfo: 5,
		display_colors: ['#2196f3','#ff0000'],
  //  okColor: '#2196f3',
  //  errorColor: '#ff0000',

  },
  url: "",
  loaded: false,
  data: {},
  wrapper: null,
  suspended: false,
  charts: [],
  pointColors: [],

  getScripts: function () {
    return ["moment.js", "modules/" + this.name + "/node_modules/chart.js/dist/Chart.min.js"];
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    self = this;
    //  Set locale.
    moment.locale(config.language);
    console.log("config =" + JSON.stringify(this.config));
    this.sendSocketNotification("CONFIG", this.config);
    for (var i = 0; i < self.config.Pins.length; i++) {
      self.pointColors[i] = []
    }

  },
  suspend: function () {
    self.suspended = true;
    self.sendSocketNotification("SUSPEND", null);
  },
  resume: function () {
    self.suspended = false;
    self.sendSocketNotification("RESUME", null);
  },

  getDom: function () {

    // if the MM wrapper hasn't been created
    if (self.wrapper == null) {
      self.wrapper = document.createElement("div");
      self.wrapper.className = "wrapper";
      // if the charts will be side by side
      if (!this.config.stacked){
        // set the width
        self.wrapper.style.maxWidth = this.config.maxWidth;
        self.wrapper.style.width = self.config.width + "px";
        self.wrapper.style.height = ((parseInt(self.config.height) + 20) * self.config.Pins.length) + "px";        
      }
    }
    // if we are not suspended/hidden due to sleep or whatever
    if (self.suspended == false) {
      // make sure we don't start before the data gets here
      if (!this.loaded) {
        this.loaded = true;
        self.overrideChartLine();
        return self.wrapper;
      } else {
        // loop thru the data from the blynk server
        for (var pin_index = 0; pin_index < self.config.Pins.length; pin_index++) {
          // get the pin text name. used for index into the data hash
          var this_pin = self.config.Pins[pin_index];
          // clear the work variable
          var canvas = null;
          // try to locate the existing chart
          if ((canvas = document.getElementById("myChart" + this_pin)) == null) {
            var c = document.createElement("div");
            c.style.width = self.config.width + "px";
            c.style.height = self.config.height + "px";
            if (!self.config.stacked)
              c.style.display = 'inline-block';
            self.wrapper.appendChild(c);

            canvas = document.createElement("canvas");
            canvas.id = "myChart" + this_pin;
            c.appendChild(canvas);
          }
          // if the chart has been created
          if (self.charts[pin_index] != null) {
              // destroy it, update doesn't work reliably
              self.charts[pin_index].destroy();
              // make it unreferenced
              self.charts[pin_index] = 0;
          }
          // create it now
          self.charts[pin_index] = new Chart(canvas, {
              type: 'line',
              showLine: true,
              data: {
                datasets: [{
                    xAxisID: 'dates',
                    data: self.data[this_pin].data,
                    fill: true,
                    borderColor: '#2196f3', // Add custom color border (Line)
                    backgroundColor:self.data[this_pin].gradient //self.pointColors[pin_index]  //'#2196f3',
                  },
                ]
              },
              options: {
                legend: {
                  display: false
                },
                tooltips: {
                  enabled: false,
                  displayColors: false
                },
                responsive: false,
                elements: {
                  point: {
                    radius: 0
                  },
                  line: {
                    tension: 0, // disables bezier curves
                  }
                },
                scales: {
                  xAxes: [{
                      id: 'dates',
                      type: 'time',
                      distribution: 'linear',
                      scaleLabel: {
                        display: true,
                        labelString: self.config.labels[pin_index] + " - last " + self.config.dayrange + " days" + " "+ moment().format('hh:mm:ss'),
                        fontColor: 'white'
                      },
                      gridLines: {
                        display: false,
                        zeroLineColor: '#ffcc33'
                      },
                      time: {
                        unit: 'minute'
                      },
                      bounds: 'data',
                      ticks: {
                        display: false,
                        maxRotation: 90,
                        source: 'data',
                        maxTicksLimit: self.data[this_pin].data.length,
                      },
                    }
                  ],
                  yAxes: [{
                      display: true,
                      scaleLabel: {
                        display: true,
                        labelString: self.config.yaxis_legend[pin_index],
                        fontColor: 'white'
                      },
                      gridLines: {
                        display: true,
                        color: "#FFFFFF",
                        zeroLineColor: '#ffcc33',
                        fontColor: 'white',
                        scaleFontColor: 'white',
                      },

                      ticks: {
                        beginAtZero: true,
                        source: 'data',
                        min: self.config.ranges[pin_index].min,
                        suggestedMax: self.config.ranges[pin_index].max,
                        stepSize: self.config.ranges[pin_index].stepSize,
                        fontColor: 'white'
                      },
                    }
                  ]
                },
              }
            }
          );
        }
      }
    }
    return self.wrapper;
  },

  notificationReceived: function (notification, payload) {},

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'PinData') {
      Log.log("data from helper=" + JSON.stringify(payload));
      this.data = payload
        this.updateDom(this.config.initialLoadDelay);
    }
  },


// decimal rounding algorithm
// see: https://plnkr.co/edit/uau8BlS1cqbvWPCHJeOy?p=preview
 roundNumber : function (num, scale) {
  var number = Math.round(num * Math.pow(10, scale)) / Math.pow(10, scale);
  if(num - number > 0) {
    return (number + Math.floor(2 * Math.round((num - number) * Math.pow(10, (scale + 1))) / 10) / Math.pow(10, scale));
  } else {
    return number;
  }
},

  overrideChartLine: function ()
  {
      // save the original line element so we can still call it's 
      // draw method after we build the linear gradient
    var origLineElement = Chart.elements.Line;

    // define a new line draw method so that we can build a linear gradient
    // based on the position of each point
    Chart.elements.Line = Chart.Element.extend({
      draw: function() {
        var vm = this._view;
        var backgroundColors = this._chart.controller.data.datasets[this._datasetIndex].backgroundColor;
        var points = this._children;
        var ctx = this._chart.ctx;
        var minX = points[0]._model.x;
        var maxX = points[points.length - 1]._model.x;
        var linearGradient = ctx.createLinearGradient(minX, 0, maxX, 0);

        // if not a single color
        if(typeof backgroundColors != 'string'){			
          // but is array of color strings
          if(	typeof backgroundColors[0] === 'string') {
            // iterate over each point to build the gradient
            // same number of color values as data points another O(n) 
            points.forEach(function(point, i) {
              // `addColorStop` expects a number between 0 and 1, so we
              // have to normalize the x position of each point between 0 and 1
              // and round to make sure the positioning isn't too percise 
              // (otherwise it won't line up with the point position)
              var colorStopPosition = self.roundNumber((point._model.x - minX) / (maxX - minX), 2);
              // special case for the first color stop
              if (i === 0) {
                linearGradient.addColorStop(0, backgroundColors[i]);
              } 
              else {
                // only add a color stop if the color is different
                if ( backgroundColors[i] !== backgroundColors[i-1]) {
                  // add a color stop for the prev color and for the new color at the same location
                  // this gives a solid color gradient instead of a gradient that fades to the next color
                  linearGradient.addColorStop(colorStopPosition, backgroundColors[i - 1]);
                  linearGradient.addColorStop(colorStopPosition, backgroundColors[i]);
                }
              }  // end of not first data element 
            });  // end of data points loop
          } // end of color array gradient builder
          // must be a gradient fence position list
          else {
            Log.log("processing fence positions count="+backgroundColors.length)
            // loop thru the fence positions
            backgroundColors.forEach(function(fencePosition){
                var colorStopPosition = self.roundNumber(fencePosition.offset / points.length, 2);
                linearGradient.addColorStop(colorStopPosition,fencePosition.color)
            });  // end of gradient edge loop
          }  // end of gradient builder 

          // save the linear gradient in background color property
          // since this is what is used for ctx.fillStyle when the fill is rendered
          vm.backgroundColor = linearGradient;

        } // end of just a single color, do nothing call original draw

        // now draw the lines (using the original draw method)
        origLineElement.prototype.draw.apply(this);
      }   // end of draw function
    });   // end of extend

    // we have to overwrite the datasetElementType property in the line controller
    // because it is set before we can extend the line element (this ensures that 
    // the line element used by the chart is the one that we extended above)
    Chart.controllers.line = Chart.controllers.line.extend({
      datasetElementType: Chart.elements.Line,
    });
	}, // end of override function
});