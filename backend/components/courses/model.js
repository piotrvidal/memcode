import { db } from '../../db/init.js';

import { createProblems, deleteProblems, updateProblems } from '../problems/model';


// course: {title: "aaa"}
// problems: [{content: "a", explanation: "aa"}]
// => { courseId: 5 }
const createCourseWithProblems = (course, problems) => {
  // { validation: 'failed fields' }
  let courseId = null;
  return(
    db.one("insert into courses (title, user_oauth_id, user_oauth_provider) values (${title}, ${userOauthId}, ${userOauthProvider}) RETURNING id", course)
      .then((course) => {
        courseId = course.id;
        return db.tx((transaction) => {
          let queries = [];
          createProblems(transaction, queries, problems, courseId);
          return transaction.batch(queries);
        });
      })
      .then(() => ({ courseId }))
  );
};

const getCourses = () =>
  db.any('\
    SELECT courses.*, COUNT(*) AS "amount_of_problems"\
    FROM courses\
      LEFT OUTER JOIN problems ON problems.course_id=courses.id\
    GROUP BY courses.id;\
  ');

const updateCourseWithProblems = (newCourse, newProblems) => {
  return getCourseWithProblems(newCourse.id)
    .then((data) => {

    const oldCourse = data.data.course;
    const oldProblems = data.data.problems;

    return db.tx((transaction) => {
      let queries = [];

      const oldProblemIdsToDelete = oldProblems.filter((oldProblem) => {
        return !newProblems.find((newProblem) => newProblem.id === oldProblem.id )
      }).map((oldProblem) => oldProblem.id );

      const newProblemsToCreate = newProblems.filter((newProblem) => !newProblem.id );

      updateCourse  (transaction, queries, oldCourse, newCourse);
      deleteProblems(transaction, queries, oldProblemIdsToDelete);
      createProblems(transaction, queries, newProblemsToCreate, oldCourse.id);
      updateProblems(transaction, queries, newProblems, oldProblems);

      return transaction.batch(queries)
    })
  })
};


const updateCourse = (transaction, queries, oldCourse, newCourse) => {
  if (oldCourse.title !== newCourse.title) {
    queries.push(
      transaction.any('UPDATE courses SET title = ${title} WHERE id = ${id}', { title: newCourse.title, id: oldCourse.id })
    )
  }
};

const getCourseWithProblems = (courseId) => {
  return Promise.all([
    db.one('select * from courses where id = ${courseId}', {courseId}),
    db.any('select * from problems where course_id = ${courseId}', {courseId})
  ]).then((values) => {
    return (
    {
      data: {
        course: values[0],
        problems: values[1]
      }
    }
    )
  });
};


const deleteCourseWithProblems = (courseId) => (
  db.tx(transaction => (
    transaction.batch([
      transaction.none('delete from problems where course_id=${courseId}', { courseId }),
      transaction.none('delete from courses where id=${courseId}', { courseId }),
    ])
  ))
    .then(() => ({ data: true }))
    .catch(error => Promise.reject({ error }))
);





export { createCourseWithProblems, getCourseWithProblems, deleteCourseWithProblems, updateCourseWithProblems, getCourses };
