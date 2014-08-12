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

    var schemaDefinition = {
      schemaName: 'file',
      schema: self.fileSchema,
      options: {
        indexable: true,
        avoidTranslate: true,
        noStrict: true,
        collection: 'fs.files',
        subSchema: true
      }
    };
    elements.registerSchemaDefinition(schemaDefinition);
    elements.registerTypeHandler('file', self.download);
  });

  molecuel.on('mlcl::core::middlewareRegister:post', function(module, app) {
    app.use(multer());
    // send init event
    molecuel.emit('mlcl::files::init:post', self);
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
  if(req.files) {
    this.saveFile(req.files.files.path, req.files.files.originalname, null, function(err, result) {
      if(err) {
        return res.send(500, err);
      }
      res.send({files: [result]});
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
  var id = res.locals.data.main._id;
  files.deleteById(id, function(err) {
    if(err) {
      res.send(500);
    } else {
      res.send(200);
    }
  });
};

files.prototype.deleteById = function deleteById(id, callback) {
  var files = getInstance();
  var grid = files.grid;
  grid.deleteFile(id, null, function(err) {
    if(err) {
      return callback(err);
    } else {
      if(elements && elements.elastic) {
        elements.elastic.delete('file', id, function() {
          return callback();
        });
      }
    }
  });
}

files.prototype.saveFile = function saveFile(path, name, options, callback) {
  var files = getInstance();

  /**
   * renderResult
   * renders the result from the db into a json object with delete url etc
   * @param res
   * @param dataset
   */
  var renderResult = function renderResult(dataset) {
    var result;
    if(dataset) {
      result = {
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
    }
    return result;
  };

  files.grid.putUniqueFile(path, name, null, function(err, result) {
    var dbResult;
    var fileModel = elements.getModel('file');

    if(err && err.name === 'NotUnique') { //File already in gridfs
      dbResult = err.result;
      if(dbResult) {
        if(!dbResult.url || (options && options.url && options.url !== dbResult.url)) {
          fileModel.findById(dbResult._id, function(err, myobj) {
            // save it again to ensure url creation
            if(options && options.url) {
              myobj.url = options.url;
            }
            myobj.save(function(err, obj) {
              if(err) {
                return callback(err);
              }
              return callback(null, renderResult(obj));
            });
          });
        } else {
          return callback(null, renderResult(dbResult));
        }
      }
    } else if(err) {
      return callback(err);
    } else {
      dbResult = result;
      fileModel.findById(dbResult._id, function(err, myobj) {
        if(options && options.url) {
          myobj.url = options.url;
        }
        // save it again to ensure url creation
        myobj.save(function(err, obj) {
          if(err) {
            return callback(err);
          }
          return callback(null, renderResult(obj));
        });
      });
    }
  });
};


var init = function(mlcl) {
  molecuel = mlcl;
  return getInstance();
};

module.exports = init;