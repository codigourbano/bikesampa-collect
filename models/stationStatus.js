/**
 * Module dependencies
 */

var
  mongoose = require('mongoose'),
  Schema = mongoose.Schema;

/*
 * Schemma
 */

var StationStatusSchema = new Schema({
  hour: {type: Date, index: true, required: true}, // hour of the event
  station: {type: Number, index: true, required: true},
  sample_size: Number,
  minutes_online: Number,
  minutes_offline: Number,
  minutes_empty: Number,
  minutes_full: Number,
  bikes_available_sum: Number,
  capacity_sum: Number,
  values: {},
  updatedAt: Date
}, { strict: false});

/**
 * Register
 */

mongoose.model('station_status', StationStatusSchema);
