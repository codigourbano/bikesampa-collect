var fs = require('fs');
var _ = require('underscore');
var async = require('async');
var winston = require('winston');
var mongoose = require('mongoose');
var bikesampa = require('bikesampa-scraper');
var moment = require('moment');
var config = require('./config.js')

/*
 * Init database
 */

var connect = function () {
  var options = { server: { socketOptions: { keepAlive: 1 } } };
  mongoose.connect(config.db, options);
};
connect();

mongoose.connection.on('error', console.log);
mongoose.connection.on('disconnected', connect);

/*
 * Bootstrap Models
 */

var StationStatus;
var Station;

fs.readdirSync(__dirname + '/models').forEach(function (file) {
  if (~file.indexOf('.js')) require(__dirname + '/models/' + file);
});


/*
 * Start script when mongoose is ready
 */
mongoose.connection.on('connected', function(){
  winston.info('Script initiated.');
  StationStatus = mongoose.model('station_status');
  Station = mongoose.model('station');
  getData();
  setInterval(getData, 60 * 1000);
});


/*
 * Setup logging
 */
var MongoDB = require('winston-mongodb').MongoDB;
winston.add(MongoDB, {dbUri: config.db});

// get data from site
function getData(cb) {
  bikesampa.scrape(function(err, result){
    if (err) return winston.log(err);
    persist(result, function(err){
      if (err) return winston.error(err);
      winston.info('Data scraped succesfully.');
    });
  })
}

function persist(stations, donePersist) {
  var now = moment();
  var minutes = moment().minutes();
  var hour = moment().startOf('hour');

  function saveStationsBasicInfo(doneSaveStationsBasicInfo) {
    async.eachSeries(stations, function(s, doneEach){

      // save/update station
      Station.update({
        _id: s.id
      }, {
        $set: {
          name: s.name,
          address: s.address,
          capacity: s.capacity,
          location: {type: 'Point', coordinates: [s.lon, s.lat]}
        }
      }, {upsert:true}, doneEach);

    }, doneSaveStationsBasicInfo)

  }

  function saveStationsStatus(doneSaveStationsStatus) {
    async.eachSeries(stations, function(s, doneEach){

      var isOnline = s.status == "EO";
      var isUnderConstruction = s.status == "EI";

      // this is the only way to set property
      // name dinamically in mongoose
      var setObject = {};
      setObject['values.'+ minutes] = {
        capacity: s.capacity,
        units: s.units,
        service: s.service,
        status: s.status,
        online: isOnline
      };
      setObject.updatedAt = now;

      StationStatus.update({
        hour: hour,
        station: s.id
      },{
        $set: setObject,
        $inc: {
          sample_size: 1,
          minutes_offline: (!isOnline && !isUnderConstruction) ? 1:0,
          minutes_online: isOnline ? 1:0,
          minutes_empty: (isOnline && (s.units == 0)) ? 1:0,
          minutes_full: (isOnline && (s.units == s.capacity)) ? 1:0,
          bikes_available_sum: isOnline ? s.units : 0,
          capacity_sum: isOnline? s.capacity : 0
        }
      },{upsert:true}, doneEach);

    }, doneSaveStationsStatus);
  }

  var stats = {
    stations_total: stations.length,
    stations_installing_sum: 0,
    stations_online_sum: 0,
    stations_offline_sum: 0,
    stations_empty_sum: 0,
    stations_full_sum: 0,
    capacity_sum: 0,
    bikes_available_sum: 0
  }

  _.each(stations, function(s){

    var isOnline = (s.status == "EO");

    // station is online
    if (isOnline) {
      stats.stations_online_sum++;

      if (s.units == 0) stats.stations_empty_sum++;
      if (s.units == s.capacity) stats.stations_full_sum++;

      stats.capacity_sum = stats.capacity_sum + s.capacity;

      stats.bikes_available_sum = stats.bikes_available_sum + s.units;
    } else if (s.status == "EI") {
      stats.stations_installing_sum++;
    } else {
      stats.stations_offline_sum++;
    }
  });

  async.series([saveStationsBasicInfo, saveStationsStatus], donePersist);
}
