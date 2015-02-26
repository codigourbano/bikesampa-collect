/**
 * Module dependencies
 */

var
  mongoose = require('mongoose'),
  Schema = mongoose.Schema;

/*
 * Schemma
 */

var StationSchema = new Schema({
  _id: {type: Number},
  name: String,
  address: String,
  capacity: Number,
  location: { type: {type: String}, coordinates: []} // lon, lat
});

/**
* Geo index
**/

StationSchema.index({ loc: '2dsphere' })

/**
 * Register
 */

mongoose.model('station', StationSchema);
