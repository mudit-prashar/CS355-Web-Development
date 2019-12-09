  
/*
=======================
index.js
=======================
Student ID:23677669
=======================
*/

const http = require("http");
const https = require("https");
const url = require("url");
const querystring = require("querystring");
const crypto = require("crypto");

const host = "localhost";
const port = 3000;

const credentials = require('./auth/credentials.json');
const fs = require('fs');
let state_storage = [];
const authentication_cache = './auth/authentication-res.json';
const img_path = './album-art/';

let albums = [];
let album_art = [];
let downloaded_images = 0;
let test = [];

const new_connection = function(req,res){
    if (req.url === "/") {
        let inputForm = fs.createReadStream('./html/search-form.html');
        res.writeHead(200, {"Content-Type": "text/html"});
        inputForm.pipe(res);
        
        
    }    
    else if (req.url.startsWith("/search")) {
        let request_data = "";
        req.on("data", function (chunk) {request_data += chunk;});
        req.on("end", function () {
            let user_input = url.parse(req.url, true).query;
            console.log(user_input.artist);
            
            let state = crypto.randomBytes(20).toString("hex");
            state_storage.push({state, artist: user_input.artist});
            console.log(state_storage);
            const authorization_endpoint = "https://accounts.spotify.com/authorize";
            let uri = querystring.stringify({
                response_type:'code',
                client_id: credentials.client_id,
                redirect_uri: credentials.redirect_uri,
                state
            });
            res.writeHead(302, {Location: `${authorization_endpoint}?${uri}`});
            res.end();
        });
    }
    else if (req.url.startsWith("/return")) {
        let auth_response = url.parse(req.url, true).query;
        let previous_state = state_storage.find((state_title_pair) => state_title_pair.state === auth_response.state);
        if (previous_state === undefined) {
            res.writeHead(403);
            res.end("CSRF Detected, Aborting Request");
        }
        else if (auth_response.error) {
            res.writeHead(403);
            res.end("Spotify API Access Denied");
        }
        else {
            let artist = previous_state.artist;
            
            state_storage = state_storage.filter((element) => element.state !== auth_response.state);
            const access_token_endpoint = "https://accounts.spotify.com/api/token";
            let post_data = querystring.stringify({
                client_id : credentials.client_id,
                client_secret : credentials.client_secret,
                grant_type : "client_credentials"
                
            });
            let options = {
                method: "POST",
                headers: {
                    
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Content-Length": post_data.length
                }
            };
                let cache_valid = false;
                if(fs.existsSync(authentication_cache)){
                    let cache_content = fs.readFileSync(authentication_cache, 'utf-8');
                    cache_json = JSON.parse(cache_content);
                    if(new Date(cache_json.expiration) > Date.now()){
                        cache_valid = true;
                    }else{
                        console.log("Token expired");
                    }
                }
                if(cache_valid){
                    console.log("already cache");
                    create_search_req(cache_json, res, artist);
                }else{
                    let auth_sent_time = new Date();

                    let authentication_req = https.request(access_token_endpoint, options, function (authentication_res) {
                    received_authentication(authentication_res, artist, auth_sent_time, res );
                    });
                    authentication_req.on('error', function(e){
                        console.error(e);
                    });
                    console.log("Requesting Token");
                    authentication_req.end(post_data);
                }
            
        }
    }
    else  if(req.url.includes('/album-art/')){
        console.log('album-art endpoint');
        let artist = url.parse(req.url, true);
        let path = artist.pathname;
        image_stream = fs.createReadStream(`.${decodeURI(path)}`);
        res.writeHead(200,{"Content-Type": "image/jpeg"});
        image_stream.pipe(res);
        image_stream.on('error', function(err){
            console.log(err);
            res.writeHead(404);
            return res.end();
        });
    }
    else {
        res.writeHead(404);
        res.end();
    }
    

};

const received_authentication = function(authentication_res, artist, auth_sent_time, res){
    authentication_res.setEncoding("utf8");
    let body="";
    authentication_res.on("data", function(chunk){body += chunk;});
    authentication_res.on("end", function(){
        let spotify_auth = JSON.parse(body);
        auth_sent_time.setHours(auth_sent_time.getHours()+1);
        spotify_auth.expiration = auth_sent_time;


        console.log(spotify_auth);
        create_cache(spotify_auth);
        console.log("new cache");
        create_search_req(spotify_auth, res, artist);

    })
}
const create_cache = function(spotify_auth){
    let cacheJSON = JSON.stringify(spotify_auth);
    fs.writeFile(authentication_cache, cacheJSON, (error)=>{
        if(error){
            console.log("Error occured while saving the token ");
            throw error;

        }
        console.log('The File has been saved');

    })
}

const create_search_req = function(spotify_auth, res, artist){
    console.log(`Artist Name: ${artist}`);
    let param = {
        access_token : spotify_auth.access_token,
        q : artist,
        type : 'album',
        limit:20
    }
    let search_req_url = 'https://api.spotify.com/v1/search?'+querystring.stringify(param);
    console.log(search_req_url);


    let search_req = https.request(search_req_url, function(search_res){
        let results = "";
        
        search_res.on('data', function(chunk){results += chunk;});
       
        search_res.on('end', function(){
			let search_res_data = JSON.parse(results);
           
			for(let i=0; i < param.limit; i++ ){
                
                let artist = {
                    name: search_res_data.albums.items[i].name,
                    image: search_res_data.albums.items[i].images[1].url
                }
                
                albums.push(artist);
                
                download_images(albums[i], res);
                
			}
        })
        console.log("second API Call Begins")
        let results2 = "";
        https.get('https://www.balldontlie.io/api/v1/players', (res) => {
            res.on('data', (chunk) => {
                results2 += chunk;
                console.log(`results: ${results2}`)
            });
          
          }).on('error', (e) => {
            console.error(e);
          });
        
    });
    
    
    search_req.end();
}
const download_images = function (image_url, res){
    let img_path_name = img_path + image_url.name+'.jpeg';
    let full_img_path = `<img src="${img_path_name}">`;
    
    test.push(image_url.name+'.jpeg')
    album_art.push(full_img_path);
    
    if( fs.existsSync(img_path_name)){
        console.log("image already exists");
        generate_webpage(album_art, res);
    }
    
        
	    let image_req = https.get(image_url.image, function(image_res){
		let new_img = fs.createWriteStream(img_path_name, {'encoding':null});
		image_res.pipe(new_img);
		new_img.on("finish", function() {
			downloaded_images += 1;
			if(downloaded_images === albums.length){
				console.log('Finished Writing Images');
				generate_webpage(album_art, res);
			}
		});
    });

	image_req.on('error', function(err){console.log(err);});
};
const generate_webpage = function(album_art, res){
    let webpage = "";

	for (index = 0; index < album_art.length; index++) { 
      
         webpage += album_art[index];
         res.writeHead(200,{'Content-type': 'text/html'});

    } 
    res.end(webpage);
}

const server = http.createServer(new_connection);
server.listen(port, host);
console.log(`Server now listening on ${host}:${port}`);