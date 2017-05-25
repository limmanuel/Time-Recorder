function updateClock() {
  var currentTime = new Date ( );

  var currentYear = currentTime.getFullYear ( );
  var currentMonth = currentTime.getMonth ( ) + 1;
  var currentDay = currentTime.getDate ( );
  var yesterdayDay = currentDay - 1;
  var currentHours = currentTime.getHours ( );
  var currentMinutes = currentTime.getMinutes ( );
  var currentSeconds = currentTime.getSeconds ( );

  // Pad the minutes and seconds with leading zeros, if required
  currentMinutes = ( currentMinutes < 10 ? "0" : "" ) + currentMinutes;
  currentSeconds = ( currentSeconds < 10 ? "0" : "" ) + currentSeconds;
  // Military format
  var hourMilitary = currentHours;

  // Choose either "AM" or "PM" as appropriate
  var timeOfDay = ( currentHours < 12 ) ? "AM" : "PM";

  // Convert the hours component to 12-hour format if needed
  currentHours = ( currentHours > 12 ) ? currentHours - 12 : currentHours;

  // Convert an hours component of "0" to "12"
  currentHours = ( currentHours == 0 ) ? 12 : currentHours;

  // Compose the string for display
  var currentTimeString = currentHours + ":" + currentMinutes + ":" + currentSeconds + " " + timeOfDay;
  var currentTimeMilitary = currentHours + ":" + currentMinutes + ":" + currentSeconds;
  var currentDate = currentMonth + "-" + currentDay + "-" + currentYear;
  var yesterdayDate = currentMonth + "-" + yesterdayDay + "-" + currentYear;
  // Update the time display
  document.getElementById("clock").innerHTML = currentTimeString;
}
$(document).ready(function(){
	$('.modal').modal();
    $('select').material_select();
    $('.button-collapse').sideNav({
      menuWidth: 300,
      edge: 'left',
      closeOnClick: true,
      draggable: true
    });
    $('.tooltipped').tooltip({delay: 50});
    datepicker('#datepicker',{
    	startDate: new Date(), // This month. 
  		dateSelected: new Date(), // Today is selected. 
  		minDate: new Date(2016, 5, 1), // June 1st, 2016. 
  		maxDate: new Date(2099, 0, 1), // Jan 1st, 2099. 
  		noWeekends: true, // Weekends will be unselectable. 
  		formatter: function(el, date) {
  		    // This will display the date as `1/1/2017`. 
  			el.value = date.toDateString();
  		}
    });
});