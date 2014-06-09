/**
 * Created by dob on 01.04.14.
 */

var molecuel, elements;
var grid = require('gridfs-uploader');
var multer = require('multer');

/**
 * file module for molecuel CMS
 */
var files = function() {

  var self = this;

  molecuel.on('mlcl::elements::registrations:pre',  function(module) {


    elements = module;

    // get native mongo driver
    var mongo = elements.database.database.mongo;
    var db = elements.database.database.connection.db;
    self.grid = new grid(mongo);
    self.grid.db = db;

    self.fileSchema =  {
      // Definition of the filename
      filename: { type: String},
      // Define the content type
      contentType: { type: String},
      // length data
      length: {type: Number, 'default': 0, form: {readonly: true}},
      chunkSize: {type: Number, 'default': 0, form: {readonly: true}},
      // upload date
      uploadDate: { type: Date, 'default': Date.now, form: {readonly: true}},

      // additional metadata
      metadata: {
        filename: {type: String}
      },
      md5: { type: String, trim: true }
    };
    elements.registerSchemaDefinition('file', self.fileSchema, {
      indexable: true,
      avoidTranslate: true,
      noStrict: true,
      collection: 'fs.files',
      subSchema: true
    });
    elements.registerTypeHandler('file', self.download);
  });

  molecuel.on('mlcl::core::middlewareRegister:post', function(module, app) {
    app.use(multer());
  });
};


/* ************************************************************************
 SINGLETON CLASS DEFINITION
 ************************************************************************ */
var instance = null;

/**
 * Singleton getInstance definition
 * @return singleton class
 */
var getInstance = function () {
  if (instance === null) {
    instance = new files();
  }
  return instance;
};

/**
 * Upload handler for files
 * @param req
 * @param res
 * @param next
 */
files.prototype.upload = function(req, res) {

  var files = getInstance();

  /**
   * renderResult
   * renders the result from the db into a json object with delete url etc
   * @param res
   * @param dataset
   */
  var renderResult = function renderResult(res, dataset) {
    var files = [];

    var result = {
      name: dataset.filename,
      size: dataset.length,
      url: dataset.url,
      thumbnailUrl: dataset.url,
      deleteUrl: dataset.url,
      deleteType: 'DELETE',
      result: dataset
    };

    // file path are never relative
    if (result.url && result.url.charAt(0) !== '/') {
      result.url = '/'+result.url;
    }

    files.push(result);
    res.send({files: files});
  };

  if(req.files) {
    files.grid.putUniqueFile(req.files.files.path, req.files.files.originalname, null, function (err, result) {
      var dbResult;
      var fileModel = elements.getModel('file');

      if(err && err.name == 'NotUnique') {
        dbResult = err.result;
        if(dbResult) {
          if(!dbResult.url) {
            fileModel.findById(dbResult._id, function(err, myobj) {
              // save it again to ensure url creation
              myobj.save(function(err, obj) {
                renderResult(res, obj);
              });
            });
          } else {
            renderResult(res, dbResult);
          }
        }

      } else if(err) {
        res.send(500);
      } else {
        dbResult = result;
        fileModel.findById(dbResult._id, function(err, myobj) {
          // save it again to ensure url creation
          myobj.save(function(err, obj) {
            renderResult(res, obj);
          });
        });
      }
      
    });
  } else {
    res.send(500);
  }
};

/**
 * Download handler for elements file type
 * @param req
 * @param res
 * @param next
 */
files.prototype.download = function download(req, res, next) {
  var files = getInstance();
  var grid = files.grid;
  var id = res.locals.data.main._id;
  if(req.method === 'GET') {
    grid.getFileStream(id, function(err, filestream) {
      if(!filestream) {
        next();
      } else {
        filestream.pipe(res);
      }
    });
  } else if(req.method === 'DELETE') {
    files.deleteFile(req, res, next);
  }
};

/**
 * Delete file middleware function
 * @param req
 * @param res
 * @param next
 */
files.prototype.deleteFile = function deleteFile(req, res) {
  var files = getInstance();
  var grid = files.grid;
  var id = res.locals.data.main._id;
  grid.deleteFile(id, null, function(err) {
    if(err) {
      res.send(500);
    } else {
      if(elements && elements.elastic) {
        elements.elastic.delete('file', id, function() {
          res.send(200);
        });
      }
    }
  });
};

var init = function(mlcl) {
  molecuel = mlcl;
  return getInstance();
};

module.exports = init;