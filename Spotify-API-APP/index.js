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
            let user_input = querystring.parse(request_data);
            console.log(user_input);
            
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
    console.log(artist);
    let param = {
        access_token : spotify_auth.access_token,
        q : artist,
        type : 'album'
    }
    let search_req_url = 'https://api.spotify.com/v1/search?'+querystring.stringify(param);
    console.log(search_req_url);
    let search_req = https.request(search_req_url, function(search_res){
        recieved_search(search_res, res);
    });
    search_req.end();
}
const recieved_search = function (search_res, res){
    search_res.setEncoding('utf8');
    let body = "";
    search_res.on("data", data=>{body+=data});
    search_res.on("end", ()=>{
        let search_res_data = JSON.parse(body);
        console.log(search_res_data);
        let artist = {
            name: search_res_data.artists.items[0].name,
            genre: search_res_data.artists.items[0].genres,
            image: search_res_data.artists.items[0].images[0].url
        }
        let img_path_name = img_path + artist.name+'.png';
        if(fs.existsSync(img_path_name)){
            console.log("image already exists");
            let webpage = '<h1>${artist.name}</h1><p>${artist.genre.join()}</p><img src="${img_path_name}" />';
            res.end(webpage);
        }else{
            let image_req = https.get(artist.image, function(image_res){
                let new_img = fs.createWriteStream(img_path_name, {'encoding': null});
                image_res.pipe(new_img);
                new_img.on('finish', function() {
                    console.log("image cache");
                    let webpage = '<h1>${artist.name}</h1><p>${artist.genre.join()}</p><img src="${img_path_name}" />';
                });
            });
        }
    });
}

const server = http.createServer(new_connection);
server.listen(port, host);
console.log(`Server now listening on ${host}:${port}`);






