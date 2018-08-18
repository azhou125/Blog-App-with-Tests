'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the expect syntax available throughout
// this module
const expect = chai.expect;

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogData() {
  console.info('seeding blog data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
	const a = generateBlogData();
    seedData.push(a);
  }
  //console.log(`XXXX\n${seedData}\nXXXXX`)
  //this will return a promise
  /*BlogPost.insertMany(seedData).then( insertedBlogs => {
	BlogPost.find()
		.then(blogs=> console.log(`XXXX\n${JSON.stringify(blogs)}\nXXXXX`))}
  );*/
  return BlogPost.insertMany(seedData);
}

// used to generate data to put in db
function generateAuthor() {
  const authorsFirstName = [
    'Ang1', 'Ang2', 'Ang3', 'Ang4', 'Ang5'];
  const authorsLastName = [
    'Zhou1', 'Zhou2', 'Zhou3', 'Zhou4', 'Zhou5'];
  return {firstName: authorsFirstName[Math.floor(Math.random() * authorsFirstName.length)],
		  lastName: authorsLastName[Math.floor(Math.random() * authorsLastName.length)]};
}

// used to generate data to put in db
function generateTitle() {
  const titles = ['Title1', 'Title2', 'Title3'];
  return titles[Math.floor(Math.random() * titles.length)];
}

// used to generate data to put in db
function generateContent() {
  const contents = ['Content1', 'Content2', 'Content3'];
  return contents[Math.floor(Math.random() * contents.length)];
}

// used to generate data to put in db
function generateCreated() {
  return new Date();
}

// generate an object represnting a blog.
// can be used to generate seed data for db
// or request.body data
function generateBlogData() {
  return {
    author: generateAuthor(),
    title: generateTitle(),
	content: generateContent(),
    created: generateCreated()
  };
}


// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

describe('Blogs API resource', function() {

  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedRestaurantData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  // note the use of nested `describe` blocks.
  // this allows us to make clearer, more discrete tests that focus
  // on proving something small
  describe('GET endpoint', function() {

    it('should return all existing blogs', function() {
      // strategy:
      //    1. get back all blogs returned by by GET request to `/posts`
      //    2. prove res has right status, data type
      //    3. prove the number of blogs we got back is equal to number
      //       in db.
      //
      // need to have access to mutate and access `res` across
      // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          // so subsequent .then blocks can access response object
          res = _res;
          expect(res).to.have.status(200);
          // otherwise our db seeding didn't work
          expect(res.body).to.have.lengthOf.at.least(1);
          return BlogPost.count();
        })
        .then(function(count) {
          expect(res.body).to.have.lengthOf(count);
        });
    });


    it('should return blogs with right fields', function() {
      // Strategy: Get back all blogs, and ensure they have expected keys

      let resBlog;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.lengthOf.at.least(1);

          res.body.forEach(function(blog) {
            expect(blog).to.be.a('object');
            expect(blog).to.include.keys(
              'id', 'author', 'title', 'content');
          });
          resBlog = res.body[0];
          return BlogPost.findById(resBlog.id);
        })
        .then(function(blog) {

          expect(resBlog.id).to.equal(blog.id);
		  //console.log(`XXX\n${resBlog.author}\nYYY`);
		  //console.log(`XXX\n${blog.authorName}\nYYY`);
          expect(resBlog.author).to.equal(blog.authorName);
          expect(resBlog.title).to.equal(blog.title);
          expect(resBlog.content).to.equal(blog.content);
        });
    });
  });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the blog we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new blog', function() {

      const newBlog = generateBlogData();

      return chai.request(app)
        .post('/posts')
        .send(newBlog)
        .then(function(res) {
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.include.keys(
            'id', 'author', 'title', 'content');
          // cause Mongo should have created id on insertion
          expect(res.body.id).to.not.be.null;
		  
		  //console.log(`XXX\n${res.body.author}\nYYY`);
		  //console.log(`XXX\n${JSON.stringify(newBlog)}\nYYY`);
		  
		  expect(res.body.author).to.equal(`${newBlog.author.firstName} ${newBlog.author.lastName}`);
          expect(res.body.title).to.equal(newBlog.title);
          expect(res.body.content).to.equal(newBlog.content);

          return BlogPost.findById(res.body.id);
        })
        .then(function(blog) {
          expect(blog.authorName).to.equal(`${newBlog.author.firstName} ${newBlog.author.lastName}`);
          expect(blog.title).to.equal(newBlog.title);
          expect(blog.content).to.equal(newBlog.content);
        });
    });
  });

  describe('PUT endpoint', function() {

    // strategy:
    //  1. Get an existing blog from db
    //  2. Make a PUT request to update that blog
    //  3. Prove blog returned by request contains data we sent
    //  4. Prove blog in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        title: 'fofofofofofofof',
        content: 'futuristic fusion'
      };

      return BlogPost
        .findOne()
        .then(function(blog) {
          updateData.id = blog.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${blog.id}`)
            .send(updateData);
        })
        .then(function(res) {
          expect(res).to.have.status(204);

          return BlogPost.findById(updateData.id);
        })
        .then(function(blog) {
          expect(blog.title).to.equal(updateData.title);
          expect(blog.content).to.equal(updateData.content);
        });
    });
  });

  describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a blog
    //  2. make a DELETE request for that blog's id
    //  3. assert that response has right status code
    //  4. prove that blog with the id doesn't exist in db anymore
    it('delete a blog by id', function() {

      let blog;

      return BlogPost
        .findOne()
        .then(function(_blog) {
          blog = _blog;
          return chai.request(app).delete(`/posts/${blog.id}`);
        })
        .then(function(res) {
          expect(res).to.have.status(204);
          return BlogPost.findById(blog.id);
        })
        .then(function(_blog) {
          expect(_blog).to.be.null;
        });
    });
  });
});
