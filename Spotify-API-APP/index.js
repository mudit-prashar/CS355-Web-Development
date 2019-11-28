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


const host = "localhost";
const port = 3000;

const credentials = require('./auth/credentials.json');
const fs = require('fs');

const authentication_cache = './auth/authentication-res.json';
const img_path = './album-art/';
let albums = [];
let album_art = [];
let downloaded_images = 0;

const new_connection = function(req,res){
    if (req.url === "/") {
        let inputForm = fs.createReadStream('./html/search-form.html');
        res.writeHead(200, {"Content-Type": "text/html"});
        inputForm.pipe(res);
        
        
    }
    else if(req.url.startsWith("/favicon.ico")){
		res.writeHead(404);
		res.end();
	}    
    else if (req.url.startsWith("/search")) {
        
        req.on("data", function (chunk) {request_data += chunk;});
        req.on("end", function () {
            let artist = url.parse(req.url, true).query;
            console.log(artist.artist);
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
                }
                else{
                    const access_token_endpoint = "https://accounts.spotify.com/api/token";
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
           
        });
    }

    else  if(req.url.includes('/album-art/')){
        console.log('album-art endpoint');
        image_stream = fs.createReadStream('./album-art/Homicide.jpg');
        res.writeHead(200,{"Content-Type": "text/html"});
        
        image_stream.pipe(res);
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
    console.log(artist);
    let param = {
        access_token : spotify_auth.access_token,
        q : artist.artist,
        type : 'album'
    }
    let search_req_url = 'https://api.spotify.com/v1/search?'+querystring.stringify(param);
    console.log(search_req_url);
    let search_req = https.request(search_req_url, function(search_res){
        let results = "";
        search_res.on('data', function(chunk){results += chunk;});
        search_res.on('end', function(){
			let search_res_data = JSON.parse(results);
			let n = 20;
			for(let i=0; i < n; i++){
                
                let artist = {
                    name: search_res_data.albums.items[i].name,
                    image: search_res_data.albums.items[i].images[0].url
                }
                
                albums.push(artist);
                
                download_images(albums[i], res);
                
			}
		})
    });
    console.log("Requesting Albums");
    search_req.end();
}
const download_images = function (image_url, res){
    let img_path_name = img_path + image_url.name+'.jpg';
    let full_img_path = `<img src="${img_path_name}">`;
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
	for (index = 0; index < album_art.length; index++) { 
        res.end(album_art[index]); 
    } 
}



const server = http.createServer(new_connection);
server.listen(port, host);
console.log(`Server now listening on ${host}:${port}`);






