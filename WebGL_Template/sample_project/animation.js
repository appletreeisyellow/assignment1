// *******************************************************
// CS 174a Graphics Example Code
// animation.js - The main file and program start point.  The class definition here describes how to display an Animation and how it will react to key and mouse input.  Right now it has 
// very little in it - you will fill it in with all your shape drawing calls and any extra key / mouse controls.  

// Now go down to display() to see where the sample shapes are drawn, and to see where to fill in your own code.

"use strict"
var canvas, canvas_size, gl = null, g_addrs,
	movement = vec2(),	thrust = vec3(), 	looking = false, prev_time = 0, animate = false, animation_time = 0;
		var gouraud = false, color_normals = false, solid = false;
function CURRENT_BASIS_IS_WORTH_SHOWING(self, model_transform) { self.m_axis.draw( self.basis_id++, self.graphicsState, model_transform, new Material( vec4( .8,.3,.8,1 ), .5, 1, 1, 40, "" ) ); }


// *******************************************************
// IMPORTANT -- In the line below, add the filenames of any new images you want to include for textures!

var texture_filenames_to_load = [ "stars.png", "text.png", "earth.gif"];

// *******************************************************	
// When the web page's window loads it creates an "Animation" object.  It registers itself as a displayable object to our other class "GL_Context" -- which OpenGL is told to call upon every time a
// draw / keyboard / mouse event happens.

window.onload = function init() {	var anim = new Animation();	};
function Animation()
{
	( function init (self) 
	{
		self.context = new GL_Context( "gl-canvas" );
		self.context.register_display_object( self );
		
		gl.clearColor( 0.7, 0.9, 1, 1 );			// Background color
		
		for( var i = 0; i < texture_filenames_to_load.length; i++ )
			initTexture( texture_filenames_to_load[i], true );
		
		self.m_cube = new cube();
		self.m_obj = new shape_from_file( "teapot.obj" );
		self.m_axis = new axis();
		self.m_sphere = new sphere( mat4(), 4 );	
		self.m_fan = new triangle_fan_full( 10, mat4() );
		self.m_strip = new rectangular_strip( 1, mat4() );
		self.m_cylinder = new cylindrical_strip( 10, mat4() );
		
		// 1st parameter is camera matrix.  2nd parameter is the projection:  The matrix that determines how depth is treated.  It projects 3D points onto a plane.
		self.graphicsState = new GraphicsState( translation(0, 0,-40), perspective(45, canvas.width/canvas.height, .1, 1000), 0 );

		gl.uniform1i( g_addrs.GOURAUD_loc, gouraud);		gl.uniform1i( g_addrs.COLOR_NORMALS_loc, color_normals);		gl.uniform1i( g_addrs.SOLID_loc, solid);
		
		self.context.render();	
	} ) ( this );	
	
	canvas.addEventListener('mousemove', function(e)	{		e = e || window.event;		movement = vec2( e.clientX - canvas.width/2, e.clientY - canvas.height/2, 0);	});
}

// *******************************************************	
// init_keys():  Define any extra keyboard shortcuts here
Animation.prototype.init_keys = function()
{
	shortcut.add( "Space", function() { thrust[1] = -1; } );			shortcut.add( "Space", function() { thrust[1] =  0; }, {'type':'keyup'} );
	shortcut.add( "z",     function() { thrust[1] =  1; } );			shortcut.add( "z",     function() { thrust[1] =  0; }, {'type':'keyup'} );
	shortcut.add( "w",     function() { thrust[2] =  1; } );			shortcut.add( "w",     function() { thrust[2] =  0; }, {'type':'keyup'} );
	shortcut.add( "a",     function() { thrust[0] =  1; } );			shortcut.add( "a",     function() { thrust[0] =  0; }, {'type':'keyup'} );
	shortcut.add( "s",     function() { thrust[2] = -1; } );			shortcut.add( "s",     function() { thrust[2] =  0; }, {'type':'keyup'} );
	shortcut.add( "d",     function() { thrust[0] = -1; } );			shortcut.add( "d",     function() { thrust[0] =  0; }, {'type':'keyup'} );
	shortcut.add( "f",     function() { looking = !looking; } );
	shortcut.add( ",",     ( function(self) { return function() { self.graphicsState.camera_transform = mult( rotation( 3, 0, 0,  1 ), self.graphicsState.camera_transform ); }; } ) (this) ) ;
	shortcut.add( ".",     ( function(self) { return function() { self.graphicsState.camera_transform = mult( rotation( 3, 0, 0, -1 ), self.graphicsState.camera_transform ); }; } ) (this) ) ;

	shortcut.add( "r",     ( function(self) { return function() { self.graphicsState.camera_transform = mat4(); }; } ) (this) );
	shortcut.add( "ALT+s", function() { solid = !solid;					gl.uniform1i( g_addrs.SOLID_loc, solid);	
																		gl.uniform4fv( g_addrs.SOLID_COLOR_loc, vec4(Math.random(), Math.random(), Math.random(), 1) );	 } );
	shortcut.add( "ALT+g", function() { gouraud = !gouraud;				gl.uniform1i( g_addrs.GOURAUD_loc, gouraud);	} );
	shortcut.add( "ALT+n", function() { color_normals = !color_normals;	gl.uniform1i( g_addrs.COLOR_NORMALS_loc, color_normals);	} );
	shortcut.add( "ALT+a", function() { animate = !animate; } );
	
	shortcut.add( "p",     ( function(self) { return function() { self.m_axis.basis_selection++; console.log("Selected Basis: " + self.m_axis.basis_selection ); }; } ) (this) );
	shortcut.add( "m",     ( function(self) { return function() { self.m_axis.basis_selection--; console.log("Selected Basis: " + self.m_axis.basis_selection ); }; } ) (this) );	
};

function update_camera( self, animation_delta_time )
	{
		var leeway = 70, border = 50;
		var degrees_per_frame = .0002 * animation_delta_time;
		var meters_per_frame  = .01 * animation_delta_time;
																					// Determine camera rotation movement first
		var movement_plus  = [ movement[0] + leeway, movement[1] + leeway ];		// movement[] is mouse position relative to canvas center; leeway is a tolerance from the center.
		var movement_minus = [ movement[0] - leeway, movement[1] - leeway ];
		var outside_border = false;
		
		for( var i = 0; i < 2; i++ )
			if ( Math.abs( movement[i] ) > canvas_size[i]/2 - border )	outside_border = true;		// Stop steering if we're on the outer edge of the canvas.

		for( var i = 0; looking && outside_border == false && i < 2; i++ )			// Steer according to "movement" vector, but don't start increasing until outside a leeway window from the center.
		{
			var velocity = ( ( movement_minus[i] > 0 && movement_minus[i] ) || ( movement_plus[i] < 0 && movement_plus[i] ) ) * degrees_per_frame;	// Use movement's quantity unless the &&'s zero it out
			self.graphicsState.camera_transform = mult( rotation( velocity, i, 1-i, 0 ), self.graphicsState.camera_transform );			// On X step, rotate around Y axis, and vice versa.
		}
		self.graphicsState.camera_transform = mult( translation( scale_vec( meters_per_frame, thrust ) ), self.graphicsState.camera_transform );		// Now translation movement of camera, applied in local camera coordinate frame
	}

// *******************************************************
// Helper functions

Animation.prototype.draw_leg = function(self, model, whichSideOfLegs){
	var leg_position_x = 0,
		leg_position_y = 0,
		leg_position_z = 0;

	var legHeight = 1.5,
		legWidth = 0.5;

	var initialLegDegree = 10;
	var greyPlastic = new Material(vec4(.5, .5, .5, 1), .2, .8, .5, 20);
	var stack = [];

	function periodic_lower_leg_degree(self){
		return initialLegDegree * Math.sin( 2 * Math.PI * self.graphicsState.animation_time / 2000);
	}


	if (whichSideOfLegs == "right"){
		// upper leg
		stack.push(model);
		model = mult(model, translation(leg_position_x, leg_position_y, leg_position_z));
		model = mult(model, scale(legWidth, legHeight, legWidth));
		self.m_cube.draw(self.graphicsState, model, greyPlastic);
		model = stack.pop();

		// lower leg
		stack.push(model);
		model = mult(model, translation(leg_position_x, leg_position_y - legHeight, leg_position_z));
		model = mult(model, translation(0,legHeight/2, -legWidth/2));
		model = mult(model, rotation(periodic_lower_leg_degree(self), 1, 0, 0));
		model = mult(model, rotation(initialLegDegree, 1, 0, 0));
		model = mult(model, translation(0, -legHeight/2, legWidth/2));
		model = mult(model, scale(legWidth, legHeight, legWidth));
		self.m_cube.draw(self.graphicsState, model, greyPlastic);
		model = stack.pop();
	}
	else{ // left leg

		// upper leg
		stack.push(model);
		model = mult(model, translation(leg_position_x, leg_position_y, leg_position_z));
		model = mult(model, scale(legWidth, legHeight, legWidth));
		self.m_cube.draw(self.graphicsState, model, greyPlastic);
		model = stack.pop();

		// lower leg
		stack.push(model);
		model = mult(model, translation(leg_position_x, leg_position_y - legHeight, leg_position_z));
		model = mult(model, translation(0,legHeight/2, legWidth/2));
		model = mult(model, rotation(-periodic_lower_leg_degree(self), 1, 0, 0));
		model = mult(model, rotation(-initialLegDegree, 1, 0, 0));
		model = mult(model, translation(0, -legHeight/2, -legWidth/2));
		model = mult(model, scale(legWidth, legHeight, legWidth));
		self.m_cube.draw(self.graphicsState, model, greyPlastic);
		model = stack.pop();
	}
};

Animation.prototype.draw_bee = function (self, model_transform, x, y, z){
	var bodyBasePosition_x = x;
	var bodyBasePosition_y = y;
	var bodyBasePosition_z = z;

	var purplePlastic = new Material(vec4(.9, .5, .9, 1), .2, .5, .8, 40),
		greyPlastic = new Material(vec4(.5, .5, .5, 1), .2, .5, .8, 40),
		yellowPlastic = new Material(vec4(1, 1, 0, 1), .2, .5, .8, 40);

	var stack = [];

	// Body (middle body)
	var bodyHight = 2,
		bodyLength = 2;

	stack.push(model_transform);
	model_transform = mult(model_transform, translation(bodyBasePosition_x, bodyBasePosition_y, bodyBasePosition_z));
	model_transform = mult(model_transform, scale(4, bodyHight, bodyLength));
	self.m_cube.draw(self.graphicsState, model_transform, greyPlastic);
	model_transform = stack.pop();

	// Head: relative to Body
	stack.push(model_transform);
	model_transform = mult(model_transform, translation(bodyBasePosition_x - 3, bodyBasePosition_y, bodyBasePosition_z));
	model_transform = mult(model_transform, scale(1, 1, 1));
	self.m_sphere.draw(self.graphicsState, model_transform, purplePlastic);
	model_transform = stack.pop();

	// Lower Body: relative to Body
	stack.push(model_transform);
	model_transform = mult(model_transform, translation(bodyBasePosition_x + 6, bodyBasePosition_y, bodyBasePosition_z));
	model_transform = mult(model_transform, scale(4, 2.3, 1.8));
	self.m_sphere.draw(self.graphicsState, model_transform, yellowPlastic);
	model_transform = stack.pop();

	// Wings
	var wingWidth = 2,
		wingHight = 0.3,
		wingLength = 5;

	function periodic_wing_degree(self){
		return 50 * Math.sin(2 * Math.PI * self.graphicsState.animation_time / 2000);
	}

	stack.push(model_transform);
	model_transform = mult(model_transform, translation(bodyBasePosition_x, bodyBasePosition_y + (bodyHight + wingHight) / 2, bodyBasePosition_z + (bodyLength + wingLength) / 2));
	model_transform = mult(model_transform, translation(0, -wingHight/2, -wingLength/2));
	model_transform = mult(model_transform, rotation(periodic_wing_degree(self), 1, 0, 0));
	model_transform = mult(model_transform, translation(0, wingHight/2, wingLength/2));
	model_transform = mult(model_transform, scale(wingWidth, wingHight, wingLength));
	self.m_cube.draw(self.graphicsState, model_transform, greyPlastic);
	model_transform = stack.pop();

	stack.push(model_transform);
	model_transform = mult(model_transform, translation(bodyBasePosition_x, bodyBasePosition_y + (bodyHight + wingHight) / 2, bodyBasePosition_z - (bodyLength + wingLength) / 2));
	model_transform = mult(model_transform, translation(0, -wingHight/2, wingLength/2));
	model_transform = mult(model_transform, rotation(-periodic_wing_degree(self), 1, 0, 0));
	model_transform = mult(model_transform, translation(0, wingHight/2, -wingLength/2));
	model_transform = mult(model_transform, scale(wingWidth, wingHight, wingLength));
	self.m_cube.draw(self.graphicsState, model_transform, greyPlastic);
	model_transform = stack.pop();


	// legs
	var legHeight = 1.5,
		legWidth = 0.5;
	var initialLegDegree = 15;

	function periodic_leg_degree(self){
		return initialLegDegree * Math.sin(2 * Math.PI * self.graphicsState.animation_time / 2000);
	}

	// right legs
	stack.push(model_transform);
	model_transform = mult(model_transform, translation(0, -(bodyHight+legHeight) / 2, (bodyLength+legWidth) / 2));
	model_transform = mult(model_transform, translation(0, legHeight/2, -legWidth/2));
	model_transform = mult(model_transform, rotation(periodic_leg_degree(self), 1, 0, 0));
	model_transform = mult(model_transform, rotation(initialLegDegree, 1, 0, 0));
	model_transform = mult(model_transform, translation(0, -legHeight/2, legWidth/2));
	self.draw_leg(self, model_transform, "right");
	model_transform = mult(model_transform, translation(-1, 0, 0));
	self.draw_leg(self, model_transform, "right");
	model_transform = mult(model_transform, translation(2, 0, 0));
	self.draw_leg(self, model_transform, "right");
	model_transform = stack.pop();

	// left legs
	stack.push(model_transform);
	model_transform = mult(model_transform, translation(0, -(bodyHight+legHeight) / 2, -(bodyLength+legWidth) / 2));
	model_transform = mult(model_transform, translation(0, legHeight/2, legWidth/2));
	model_transform = mult(model_transform, rotation(-periodic_leg_degree(self), 1, 0, 0));
	model_transform = mult(model_transform, rotation(-initialLegDegree, 1, 0, 0));
	model_transform = mult(model_transform, translation(0, -legHeight/2, -legWidth/2));
	self.draw_leg(self, model_transform, "left");
	model_transform = mult(model_transform, translation(-1, 0, 0));
	self.draw_leg(self, model_transform, "left");
	model_transform = mult(model_transform, translation(2, 0, 0));
	self.draw_leg(self, model_transform, "left");
	model_transform = stack.pop();
};

/*
// TA Example
Animation.prototype.draw_legs = function(model_transform, material){

	 // move in a circle
	 model_transform = mult(model_transform, rotation(this.graphicsState.animation_time / -20, 0, 1, 0));
	 model_transform = mult(model_transform, translation(7, 0, 0)); // translate on x by radius

	 // move up and down
	 var y = Math.sin(2 * Math.PI * this.graphicsState.animation_time / 2000);
	 model_transform = mult(model_transform, translation(0, y, 0));
	 this.m_cube.draw(this.graphicsState, model_transform, material);

	 // add another cube
	 model_transform = mult(model_transform, rotation(this.graphicsState.animation_time / 10, 1, 0, 0));
	 model_transform = mult(model_transform, translation(1,0,0));
	 this.m_cube.draw(this.graphicsState, model_transform, material);

	return model_transform;
};*/

Animation.prototype.draw_trunk_piece = function(self, model, trunkPieceHeight){
	var brown = new Material(vec4(0.9, 0.4, 0.1, 1), .2, .5, .8, 20);

	model = mult(model, scale(1, trunkPieceHeight, 1));
	self.m_cube.draw(self.graphicsState, model, brown);
};



Animation.prototype.draw_foliage = function(self, model){
	var sizeOfFoliage = 4;
	var	red = new Material(vec4(1, 0, 0, 1), .2, .5, .8, 40);

	model = mult(model, scale(sizeOfFoliage, sizeOfFoliage, sizeOfFoliage));
	self.m_sphere.draw(self.graphicsState, model, red);
};



Animation.prototype.draw_tree = function(self, model_transform, x, y, z){

	var trunkBasePosition_y = y;
	var trunkPieceHeight = 2;

	function periodic_swag_degree(self){
		return 3 * Math.sin( 2 * Math.PI * self.graphicsState.animation_time / 10000);
	}

	// the lowest piece of trunk
	model_transform = mult(model_transform, translation(0, trunkBasePosition_y, 0));
	self.draw_trunk_piece(self, model_transform, trunkPieceHeight);

	// another seven trunk pieces
	for(var i = 0; i < 7; i++){
		model_transform = mult(model_transform, translation(0, trunkPieceHeight, 0));
		model_transform = mult(model_transform, translation(0, -(trunkPieceHeight/2), 0));
		model_transform = mult(model_transform, rotation(periodic_swag_degree(self), 0, 0, 1));
		model_transform = mult(model_transform, translation(0, (trunkPieceHeight/2), 0));
		self.draw_trunk_piece(self, model_transform, trunkPieceHeight);
	}

	// Foliage
	var sizeOfFoliage = 4;
	model_transform = mult(model_transform, translation(0, (sizeOfFoliage + 0.9), 0));
	self.draw_foliage(self, model_transform);
};



// *******************************************************	
// display(): called once per frame, whenever OpenGL decides it's time to redraw.

Animation.prototype.display = function(time) {
	if (!time) time = 0;
	this.animation_delta_time = time - prev_time;
	if (animate) this.graphicsState.animation_time += this.animation_delta_time;
	prev_time = time;

	update_camera(this, this.animation_delta_time);

	this.basis_id = 0;

	var model_transform = mat4();

	// Materials: Declare new ones as needed in every function.
	// 1st parameter:  Color (4 floats in RGBA format), 2nd: Ambient light, 3rd: Diffuse reflectivity, 4th: Specular reflectivity, 5th: Smoothness exponent, 6th: Texture image.
	var purplePlastic = new Material(vec4(.9, .5, .9, 1), .2, .5, .8, 40), // Omit the final (string) parameter if you want no texture
		greyPlastic = new Material(vec4(.5, .5, .5, 1), .2, .8, .5, 20),
		green = new Material(vec4(0, .9, 0, 1), .8, .5, .2, 20),

		earth = new Material(vec4(.5, .5, .5, 1), .5, 1, .5, 40, "earth.gif"),
		stars = new Material(vec4(.5, .5, .5, 1), .5, 1, 1, 40, "stars.png"),
		grass = new Material(vec4(.5, .5, .5, 1), .5, 1, 1, 40, "grass.png");

	/**********************************
	 Start coding here!!!!
	 **********************************/


	// ***********************************
	//
	// 		Start create world from here
	//
	// ***********************************

	var stack = [];

	// Ground
	stack.push(model_transform);
	model_transform = mult(model_transform, translation(0, -15, 0));
	model_transform = mult(model_transform, scale(40, 5, 40));
	this.m_sphere.draw(this.graphicsState, model_transform, green);
	model_transform = stack.pop();


	// Bee
	stack.push(model_transform);
	model_transform = mult(model_transform, rotation(this.graphicsState.animation_time / 100, 0, -1, 0));
	model_transform = mult(model_transform, translation(0, 2 * Math.sin(2 * Math.PI * this.graphicsState.animation_time / 5000), 0));
	model_transform = mult(model_transform, translation(0, 0, 15));
	this.draw_bee(this, model_transform, 0, 0, 0);
	model_transform = stack.pop();

	// Tree
	stack.push(model_transform);
	model_transform = mult(model_transform, rotation(-20, 0, 1, 0));
	this.draw_tree(this, model_transform, 0, -9, 0);
	model_transform = stack.pop();


	/*	////////////////////////
		//      Snow Man      //
		////////////////////////

	var stack = [];

	// head
	model_transform = mult(model_transform, rotation(this.graphicsState.animation_time / 20, 0, 1, 0));
	this.m_sphere.draw(this.graphicsState, model_transform, earth);

	// nose
	stack.push(model_transform);
	model_transform = mult(model_transform, translation(0, 0, 2));
	model_transform = mult(model_transform, scale(.3, .3, 1));
	this.m_fan.draw(this.graphicsState, model_transform, greyPlastic);
	//model_transform = mult(model_transform, scale(1/.3, 1/.3, 1));
	//model_transform = mult(model_transform, translation(0, 0, -2));
	model_transform = stack.pop();

	// body
	model_transform = mult(model_transform, translation(0, -3, 0));
	model_transform = mult(model_transform, scale(2, 2, 2));
	this.m_sphere.draw(this.graphicsState, model_transform, earth);

	// left arm
	stack.push(model_transform);
	model_transform = mult(model_transform, rotation(-90, 0, 1, 0));
	model_transform = mult(model_transform, translation(0, 0, 2));
	model_transform = mult(model_transform, scale(.1, .1, 2));
	this.m_cylinder.draw(this.graphicsState, model_transform, greyPlastic);
	//model_transform = mult(model_transform, scale(1 /.1, 1 /.1, 1/2));
	//model_transform = mult(model_transform, translation(0, 0, -2));
	//model_transform = mult(model_transform, rotation(90, 0, 1, 0));
	model_transform = stack.pop();

	// right arm
	stack.push(model_transform);
	model_transform = mult(model_transform, rotation(90, 0, 1, 0));
	model_transform = mult(model_transform, translation(0, 0, 2));
	model_transform = mult(model_transform, scale(.1, .1, 2));
	this.m_cylinder.draw(this.graphicsState, model_transform, greyPlastic);
	model_transform = stack.pop();

	// leg
	model_transform = mult(model_transform, translation(0, -3, 0));
	model_transform = mult(model_transform, scale(2, 2, 2));
	this.m_sphere.draw(this.graphicsState, model_transform, earth);

	*/

	/*
	 model_transform = mult( model_transform, translation( 0, 10, -15) );		// Position the next shape by post-multiplying another matrix onto the current matrix product
	 this.m_cube.draw( this.graphicsState, model_transform, purplePlastic );			// Draw a cube, passing in the current matrices
	 CURRENT_BASIS_IS_WORTH_SHOWING(this, model_transform);							// How to draw a set of axes, conditionally displayed - cycle through by pressing p and m

	 model_transform = mult( model_transform, translation( 0, -2, 0 ) );
	 this.m_fan.draw( this.graphicsState, model_transform, greyPlastic );			// Cone
	 CURRENT_BASIS_IS_WORTH_SHOWING(this, model_transform);

	 model_transform = mult( model_transform, translation( 0, -4, 0 ) );
	 this.m_cylinder.draw( this.graphicsState, model_transform, greyPlastic );		// Tube
	 CURRENT_BASIS_IS_WORTH_SHOWING(this, model_transform);


	 model_transform = mult( model_transform, translation( 0, -3, 0 ) );											// Example Translate
	 model_transform = mult( model_transform, rotation( this.graphicsState.animation_time/20, 0, 1, 0 ) );			// Example Rotate. 1st parameter is scalar for angle, last three are axis of rotation.
	 model_transform = mult( model_transform, scale( 5, 1, 5 ) );												// Example Scale
	 this.m_sphere.draw( this.graphicsState, model_transform, earth );				// Sphere

	 model_transform = mult( model_transform, translation( 0, -2, 0 ) );
	 this.m_strip.draw( this.graphicsState, model_transform, stars );				// Rectangle
	 CURRENT_BASIS_IS_WORTH_SHOWING(this, model_transform);
	 */


/*
	var stack = [];

	stack.push(model_transform);
	this.draw_legs(model_transform, purplePlastic);
	model_transform = stack.pop();

	model_transform = mult(model_transform, translation(0, -4, 0));

	stack.push(model_transform);
	this.draw_legs(model_transform, purplePlastic);
	model_transform = stack.pop();

	model_transform = mult(model_transform, translation(0, -8, 0));

*/

};



Animation.prototype.update_strings = function( debug_screen_strings )		// Strings this particular class contributes to the UI
{
	debug_screen_strings.string_map["time"] = "Animation Time: " + this.graphicsState.animation_time/1000 + "s";
	debug_screen_strings.string_map["basis"] = "Showing basis: " + this.m_axis.basis_selection;
	debug_screen_strings.string_map["animate"] = "Animation " + (animate ? "on" : "off") ;
	debug_screen_strings.string_map["thrust"] = "Thrust: " + thrust;
};
