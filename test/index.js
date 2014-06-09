/**
 * Created by Dominic Böttger on 09.06.14.
 * INSPIRATIONlabs GmbH
 * http://www.inspirationlabs.com
 */
/**
 * Created by Dominic Böttger on 11.05.2014
 * INSPIRATIONlabs GmbH
 * http://www.inspirationlabs.com
 */
var should = require('should'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  express = require('express'),
  mlcl_database = require('mlcl_database'),
  mlcl_elastic = require('mlcl_elastic'),
  request = require('request'),
  mlcl_elements = require('mlcl_elements'),
  txtReadPath = __dirname + '/testfiles/1.txt',
  //testBin = __dirname + '/testfiles/binary.bin',
  //outputPath =  __dirname + '/testfiles/output.txt',
  //pdfFile = __dirname + '/testfiles/test.pdf',
  //pngFile = __dirname + '/testfiles/test.png',
  //jpgFile = __dirname + '/testfiles/test.jpg',
  //pngFileDe = __dirname + '/testfiles/test_de.png',
  fs = require('fs'),
  path = require('path'),
  mlcl_files = require('../');

describe('mlcl_elastic', function() {
  var mlcl;
  var molecuel;
  var mongo;
  var elastic;
  var elements;
  var files;

  before(function(done) {
    // init fake molecuel
    mlcl = function() {
      return this;
    };
    util.inherits(mlcl, EventEmitter);
    molecuel = new mlcl();

    molecuel.config = { };
    molecuel.config.search = {
      hosts: ['http://localhost:9200'],
      prefix: 'mlcl-files-unit'
    };
    molecuel.config.database = {
      type: 'mongodb',
      uri: 'mongodb://localhost/mlcl-files-unit'
    };

    molecuel.config.elements = {
      schemaDir: __dirname + '/definitions'
    };

    mongo = mlcl_database(molecuel);
    elements = mlcl_elements(molecuel);
    elastic = mlcl_elastic(molecuel);
    files = mlcl_files(molecuel);
    done();
  });

  describe('files', function() {
    var elements;
    var app;

    it('should initialize db connection', function(done) {
      molecuel.once('mlcl::elements::init:post', function(ele) {
        elements = ele;
        ele.should.be.a.object;
        done();
      });
      molecuel.emit('mlcl::core::init:post', molecuel);
    });

    it('should initialize the middleware', function(done) {
      app = express();
      molecuel.emit('mlcl::core::middlewareRegister:post', molecuel, app);
      //elements.initApplication(app);
      app.post('/file/upload', files.upload );
      app.listen(8000);
      done();
    });

    describe('upload', function() {
      it('should upload a file successfully', function(done) {
        this.timeout(5000);
        var r = request.post('http://localhost:8000/file/upload', function optionalCallback (err, httpResponse, body) {
          should.not.exists(err);
          should.exist(body);
          var myres = JSON.parse(body);
          myres.should.be.an.Object;
          myres.files.should.be.an.Object;
          myres.files[0].should.be.an.Object;
          done();
        });
        var form = r.form();
        form.append('files', fs.createReadStream(path.join(txtReadPath)));
      });
    });

    after(function(done) {
      elements.database.database.connection.db.dropDatabase(function(error) {
        should.not.exists(error);
        elements.elastic.deleteIndex('*', function(error) {
          should.not.exists(error);
          done();
        });
      });
    });
  });
});
